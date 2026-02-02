import express from "express";
import supabase from "../config/supabase.js";

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
    const { time_id, name, address, phone, email, seller_name } = req.body;

    if (!time_id || !name || !address || !phone || !email) {
        return res
            .status(400)
            .json({ error: "time_id, name, address, phone och email krävs" });
    }

    // Anropa vår nya Postgres-funktion (RPC) för race-safe bokning
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

    // result är JSONB från funktionen: { success: true/false, booking_id, error, ... }
    if (!result || !result.success) {
        return res.status(400).json({ error: result?.error || "Bokningen misslyckades" });
    }

    // Bokning lyckades!
    const bookingId = result.booking_id;
    const startTime = result.start_time;

    // 4. Skicka till Google Apps Script (Webhook) - "Fire and forget"
    const webhookUrl = process.env.APPS_SCRIPT_WEBHOOK_URL;
    if (webhookUrl) {
        // Vi kör detta asynkront utan await för att inte blockera svaret till kund
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
                seller_name: seller_name || null
            })
        }).catch(err => console.error("Webhook fail:", err));
    }

    res.json({ success: true, message: "Bokning klar", booking_id: bookingId });
});

export default router;
