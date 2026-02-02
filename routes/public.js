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

    // 1. Kolla att tiden finns och inte redan är bokad
    const { data: timeRow, error: timeError } = await supabase
        .from("available_times")
        .select("*")
        .eq("id", time_id)
        .single();

    if (timeError || !timeRow) {
        return res.status(400).json({ error: "Tiden finns inte" });
    }

    if (timeRow.is_booked) {
        return res.status(400).json({ error: "Tiden är redan bokad" });
    }

    // 2. Skapa bokningen och få tillbaka raden (inkl. id)
    const { data: bookingRow, error: bookingError } = await supabase
        .from("bookings")
        .insert([
            {
                time_id,
                name,
                address,
                phone,
                email,
                seller_name: seller_name || null,
                start_time: timeRow.start_time
            }
        ])
        .select()
        .single();

    if (bookingError) {
        console.error(bookingError);
        return res.status(500).json({ error: "Kunde inte spara bokningen" });
    }

    // 3. Markera tiden som bokad
    const { error: updateError } = await supabase
        .from("available_times")
        .update({ is_booked: true })
        .eq("id", time_id);

    if (updateError) {
        console.error(updateError);
        return res
            .status(500)
            .json({ error: "Bokningen sparades men kunde inte uppdatera tiden" });
    }

    // 4. Skicka till Google Apps Script (Google Sheets + mail)
    const webhookUrl = process.env.APPS_SCRIPT_WEBHOOK_URL;
    if (webhookUrl) {
        try {
            await fetch(webhookUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    booking_id: bookingRow.id,
                    time_id,
                    name,
                    address,
                    phone,
                    email,
                    start_time: timeRow.start_time,
                    seller_name: seller_name || null
                })
            });
        } catch (err) {
            console.error("Kunde inte anropa Apps Script-webhook:", err);
        }
    } else {
        console.warn("Ingen APPS_SCRIPT_WEBHOOK_URL satt i .env");
    }

    // 5. Svar tillbaka till frontend
    res.json({ success: true, message: "Bokning klar" });
});

export default router;
