import express from "express";
import supabase from "../config/supabase.js";
import { getBasePrice, validatePromoCode, calculatePrice, incrementUsage } from "../services/promo.service.js";

const router = express.Router();

// -----------------------------------------------------------
// PUBLIC: Hämta lediga tider
// -----------------------------------------------------------
router.get("/times", async (req, res) => {
    const { data, error } = await supabase
        .from("available_times")
        .select("id, start_time")
        .eq("is_booked", false)
        .order("start_time", { ascending: true });

    if (error) {
        console.error(error);
        return res.status(500).json({ error: "Could not fetch times" });
    }

    res.json(data);
});

// -----------------------------------------------------------
// PUBLIC: Boka tid
// body: { time_id, name, address, phone, email }
// -----------------------------------------------------------
router.post("/book", async (req, res) => {
    // 1. Extract fields
    const { time_id, name, address, phone, email, seller_name, service, promo_code } = req.body;

    if (!time_id || !name || !address || !phone || !email) {
        return res
            .status(400)
            .json({ error: "time_id, name, address, phone, och email krävs" });
    }

    // 2. Prepare Pricing & Promo Logic (Server-side Source of Truth)
    const basePrice = getBasePrice(service); // Default 1500 if service missing
    let finalPrice = basePrice;
    let discountPercent = 0;

    let promoData = {
        code: null,
        id: null,
        valid: false,
        reason: null
    };

    // 3. Validate Promo Code (if provided)
    if (promo_code) {
        // NOTE: For v1 Global Codes, we pass null as sellerUserId.
        // If we strictly needed seller validation, we'd need to fetch the seller for this booking context,
        // but spec says "Kundflödet ska kunna skicka promo_code utan seller_user_id".
        const validation = await validatePromoCode(promo_code, null);

        if (validation.valid) {
            promoData.valid = true;
            promoData.code = validation.code;
            promoData.id = validation.id;
            discountPercent = validation.discount_percent;

            const priceCalc = calculatePrice(basePrice, discountPercent);
            finalPrice = priceCalc.finalPrice;
        } else {
            promoData.valid = false;
            promoData.reason = validation.reason;
            // Invalid code -> Full price
            promoData.code = promo_code; // Store the attempted code (raw or normalized? Spec says normalized in DB)
        }
    }

    // 4. Book Time Slot (Race-safe reservation via RPC)
    const { data: result, error: rpcError } = await supabase.rpc("book_time_slot", {
        p_time_id: time_id,
        p_name: name,
        p_address: address,
        p_phone: phone,
        p_email: email,
        p_seller_name: seller_name || null
    });

    if (rpcError) {
        console.error("RPC Error:", rpcError);
        return res.status(500).json({ error: "Ett tekniskt fel uppstod vid bokning." });
    }

    if (!result || !result.success) {
        return res.status(400).json({ error: result?.error || "Bokningen misslyckades" });
    }

    const bookingId = result.booking_id;
    const startTime = result.start_time;

    // 5. Apply Promo Usage & Finalize Price (Post-Booking Update)
    let usageSuccess = true;
    if (promoData.valid && promoData.id) {
        // Try increment usage
        const usageResult = await incrementUsage(promoData.id);
        if (!usageResult.success) {
            // Revert discount if limit reached (Race condition catch)
            usageSuccess = false;
            promoData.valid = false;
            promoData.reason = "usage_limit_reached_at_checkout";
            finalPrice = basePrice;
            discountPercent = 0;
            console.warn(`Promo usage limit hit for ${promoData.code} during booking ${bookingId}`);
        }
    }

    // 6. Update Booking with Price & Promo Info
    const { error: updateError } = await supabase
        .from("bookings")
        .update({
            base_price_sek: basePrice,
            discount_percent: discountPercent,
            final_price_sek: finalPrice,
            promo_code: promoData.code ? promoData.code.toUpperCase() : null, // Normalize stored code
            promo_code_id: (promoData.valid && usageSuccess) ? promoData.id : null // Only link ID if actually used validly
        })
        .eq("id", bookingId);

    if (updateError) {
        console.error("Failed to update booking price:", updateError);
        // We don't fail the booking, but we log critical error. 
        // Admin might need to fix manually.
    }

    // 7. Webhook & Response
    const webhookUrl = process.env.APPS_SCRIPT_WEBHOOK_URL;
    if (webhookUrl) {
        fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                booking_id: bookingId,
                time_id,
                name,
                address,
                phone,
                email,
                start_time: startTime,
                seller_name: seller_name || null,
                // Add price info to webhook
                service: service || "mattvätt",
                promo_code: promoData.code,
                final_price: finalPrice
            })
        }).catch(err => console.error("Webhook fail:", err));
    }

    res.json({
        success: true,
        message: "Bokning klar",
        booking_id: bookingId,
        // Return pricing info
        base_price_sek: basePrice,
        discount_percent: discountPercent,
        final_price_sek: finalPrice,
        promo_code_valid: promoData.valid,
        promo_code_reason: promoData.reason
    });
});

// -----------------------------------------------------------
// PUBLIC: Validera kampanjkod (utan bokning)
// -----------------------------------------------------------
router.post("/validate-promo", async (req, res) => {
    try {
        const raw = req.body?.promo_code;
        const code = (raw || "").trim().toUpperCase();

        if (!code) return res.json({ valid: false });

        const { data, error } = await supabase
            .from("promo_codes")
            .select("code, discount_percent, active, starts_at, ends_at")
            .eq("code", code)
            .single();

        if (error || !data) return res.json({ valid: false, reason: "not_found" });
        if (data.active !== true) return res.json({ valid: false, reason: "inactive" });

        const now = new Date();
        if (data.starts_at && new Date(data.starts_at) > now) return res.json({ valid: false, reason: "not_started" });
        if (data.ends_at && new Date(data.ends_at) < now) return res.json({ valid: false, reason: "expired" });

        return res.json({
            valid: true,
            code: data.code,
            discount_percent: data.discount_percent ?? 0
        });
    } catch (err) {
        console.error("validate-promo error:", err);
        return res.status(500).json({ valid: false, error: "Internt serverfel" });
    }
});

export default router;
