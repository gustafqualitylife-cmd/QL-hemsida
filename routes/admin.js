import express from "express";
import supabase from "../config/supabase.js";
import openai from "../config/openai.js";
import { requireAuth, requireRole } from "../middleware/requireAuth.js"; // New auth
import upload from "../middleware/upload.js";

const router = express.Router();

// New: Require 'admin' role from profiles
router.use(requireAuth);
router.use(requireRole('admin'));

// -----------------------------------------------------------
// ADMIN: Hämta bokningar (inkl. besökstid/start_time)
// -----------------------------------------------------------
router.get("/bookings", async (req, res) => {
    // TEMPORARY: Simplified query without JOIN to debug 500 error
    const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Admin bookings error:", error);
        return res.status(500).json({ error: "Kunde inte hämta bokningar", details: error.message });
    }

    res.json(data || []);
});

// -----------------------------------------------------------
// ADMIN: Hämta en specifik bokning
// -----------------------------------------------------------
router.get("/bookings/:id", async (req, res) => {
    const bookingId = req.params.id;

    const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .single();

    if (error) {
        console.error("Admin booking detail error:", error);
        return res.status(500).json({ error: "Could not fetch booking details" });
    }

    if (!data) return res.status(404).json({ error: "Booking not found" });

    // Fetch files
    const { data: files } = await supabase
        .from("booking_files")
        .select("*")
        .eq("booking_id", bookingId);

    data.files = files || [];

    res.json(data);
});

// -----------------------------------------------------------
// ADMIN: Ladda upp fil
// -----------------------------------------------------------
router.post("/bookings/:id/files", upload.single("file"), async (req, res) => {
    const bookingId = req.params.id;
    const { file_type } = req.body;

    if (!req.file) return res.status(400).json({ error: "Ingen fil." });

    try {
        const file = req.file;
        const safeName = file.originalname.replace(/\s+/g, "_");
        const filePath = `${bookingId}/${Date.now()}-${safeName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from("booking-files")
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (uploadError) {
            console.error("Upload error:", uploadError);
            return res.status(500).json({ error: "Upload failed" });
        }

        const { data: publicUrlData } = supabase.storage
            .from("booking-files")
            .getPublicUrl(uploadData.path);

        const fileUrl = publicUrlData.publicUrl;

        // Spara i DB
        const { data: fileRow, error: dbError } = await supabase
            .from("booking_files")
            .insert([
                {
                    booking_id: bookingId,
                    file_name: file.originalname,
                    file_url: fileUrl,
                    uploaded_by_user_id: req.user.id,
                    uploaded_by_role: 'admin',
                    file_type: file_type || 'other'
                }
            ])
            .select()
            .single();

        if (dbError) {
            console.error("DB insert error:", dbError);
            return res.status(500).json({ error: "File uploaded but DB record failed" });
        }

        res.json({ success: true, file: fileRow });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error during upload" });
    }
});

router.patch("/bookings/:id/assign", async (req, res) => {

    const { seller_user_id, seller_name } = req.body;
    const bookingId = req.params.id;

    if (!seller_user_id) {
        return res.status(400).json({ error: "seller_user_id krävs" });
    }

    const { data, error } = await supabase
        .from("bookings")
        .update({
            seller_user_id,
            seller_name: seller_name || null, // Optional display name
            status: 'assigned' // Auto-update status
        })
        .eq("id", bookingId)
        .select()
        .single();

    if (error) {
        console.error(error);
        return res.status(500).json({ error: "Kunde inte tilldela säljare" });
    }

    res.json({ success: true, booking: data });
});

// -----------------------------------------------------------
// ADMIN: Ändra status (status, payment_status, etc)
// -----------------------------------------------------------
router.patch("/bookings/:id", async (req, res) => {
    const bookingId = req.params.id;
    const updates = req.body; // e.g. { status: 'won', payment_status: 'paid' }

    // Sanitize updates - allow only specific fields
    const allowedUpdates = {};
    if (updates.status) allowedUpdates.status = updates.status;
    if (updates.payment_status) allowedUpdates.payment_status = updates.payment_status;
    if (updates.duration_minutes) allowedUpdates.duration_minutes = updates.duration_minutes;

    if (Object.keys(allowedUpdates).length === 0) {
        return res.status(400).json({ error: "Inga giltiga fält att uppdatera" });
    }

    const { data, error } = await supabase
        .from("bookings")
        .update(allowedUpdates)
        .eq("id", bookingId)
        .select()
        .single();

    if (error) {
        console.error(error);
        return res.status(500).json({ error: "Kunde inte uppdatera bokning" });
    }

    res.json({ success: true, booking: data });
});

// -----------------------------------------------------------
// ADMIN: Lista säljare (från profiles + users)
// -----------------------------------------------------------
router.get("/sellers", async (req, res) => {
    // Behöver joina auth.users om vi kunde, men vi kan inte joina auth-schemat direkt med JS-klienten alltid.
    // Vi hämtar profiles och litar på att vi har email där (om vi lagt till den).
    // I vår SQL plan lade vi till email i profiles.

    const { data, error } = await supabase
        .from("profiles")
        .select("id, email, role")
        .eq("role", "seller");

    if (error) {
        console.error(error);
        return res.status(500).json({ error: "Kunde inte hämta säljare" });
    }

    res.json(data || []);
});


// -----------------------------------------------------------
// ADMIN: Management av tider
// -----------------------------------------------------------
// GET all times (for calendar view)
router.get("/times", async (req, res) => {
    const { data, error } = await supabase
        .from("available_times")
        .select("*")
        .order("start_time", { ascending: true });

    if (error) {
        console.error("Admin get times error:", error);
        return res.status(500).json({ error: "Kunde inte hämta tider" });
    }
    res.json(data || []);
});

router.post("/times", async (req, res) => {
    const { start_time } = req.body;
    if (!start_time) return res.status(400).json({ error: "start_time krävs" });

    const { error } = await supabase
        .from("available_times")
        .insert([{ start_time }]);

    if (error) {
        console.error(error);
        return res.status(500).json({ error: "Kunde inte skapa tiden" });
    }
    res.json({ success: true, message: "Tid tillagd" });
});

router.delete("/times/:id", async (req, res) => {
    const { error } = await supabase
        .from("available_times")
        .delete()
        .eq("id", req.params.id)
        .eq("is_booked", false);

    if (error) {
        console.error(error);
        return res.status(500).json({ error: "Kunde inte ta bort tiden" });
    }
    res.json({ success: true, message: "Tid borttagen" });
});

// -----------------------------------------------------------
// ADMIN: Filer och AI (Upload koden återanvänds men nu med req.user)
// -----------------------------------------------------------
// -----------------------------------------------------------
// ADMIN: Filer och AI (Upload koden återanvänds men nu med req.user)
// -----------------------------------------------------------
router.post("/bookings/:id/files", upload.single("file"), async (req, res) => {
    const bookingId = req.params.id;
    const { file_type } = req.req ? req.body : req.body || {}; // Safe access if multer doesn't populate it yet (it should)

    if (!req.file) return res.status(400).json({ error: "Ingen fil." });

    // Validera file_type
    // Admin kan ladda upp vad som helst, default 'other'
    const validTypes = ['offer', 'before', 'after', 'other'];
    const type = validTypes.includes(req.body.file_type) ? req.body.file_type : 'other';

    try {
        const file = req.file;
        const safeName = file.originalname.replace(/\s+/g, "_");
        const filePath = `${bookingId}/${Date.now()}-${safeName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from("booking-files")
            .upload(filePath, file.buffer, { contentType: file.mimetype });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
            .from("booking-files")
            .getPublicUrl(uploadData.path);

        // Save to DB
        const { data: fileRow, error: insertError } = await supabase
            .from("booking_files")
            .insert([{
                booking_id: bookingId,
                file_name: file.originalname,
                file_url: publicUrlData.publicUrl,
                uploaded_by_user_id: req.user.id,
                uploaded_by_role: 'admin',
                file_type: type
            }])
            .select()
            .single();

        if (insertError) throw insertError;

        // Trigger AI async (only if it's an offer)
        if (type === 'offer') {
            // Logic to trigger AI or just let frontend do it
        }

        res.json({ success: true, file: fileRow });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Upload failed" });
    }
});

// ... AI logic can remain similar or requireAuth updated
res.status(500).json({ error: "Server error during upload" });
    }
});


// -----------------------------------------------------------
// ADMIN: Kampanjkoder CRUD
// -----------------------------------------------------------

// LISTERA
router.get("/promo-codes", async (req, res) => {
    const { data, error } = await supabase
        .from("promo_codes")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error(error);
        return res.status(500).json({ error: "Kunde inte hämta kampanjkoder" });
    }
    res.json(data || []);
});

// SKAPA
router.post("/promo-codes", async (req, res) => {
    // fields: code, discount_percent, usage_limit, active, starts_at, ends_at, notes, seller_user_id (optional, global if null)
    // admin can create code for any seller or global
    const {
        code,
        discount_percent,
        active,
        starts_at,
        ends_at,
        usage_limit,
        notes,
        seller_user_id
    } = req.body;

    if (!code) return res.status(400).json({ error: "Kampanjkod krävs" });

    const { data, error } = await supabase
        .from("promo_codes")
        .insert([{
            code: code.trim().toUpperCase(),
            discount_percent: discount_percent || 50,
            active: active !== undefined ? active : true,
            starts_at: starts_at || null,
            ends_at: ends_at || null,
            usage_limit: usage_limit || null,
            notes: notes || null,
            seller_user_id: seller_user_id || null, // Global by default unless specified
            created_by: req.user.id
        }])
        .select()
        .single();

    if (error) {
        // Handle unique constraint violation specifically if needed
        if (error.code === '23505') { // unique_violation
            return res.status(400).json({ error: "Koden finns redan" });
        }
        console.error(error);
        return res.status(500).json({ error: "Kunde inte skapa kampanjkod" });
    }

    res.json({ success: true, promo_code: data });
});

// UPPDATERA (Patch)
router.patch("/promo-codes/:id", async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    // Allowed fields to update
    const allowed = ['active', 'usage_limit', 'starts_at', 'ends_at', 'notes', 'discount_percent', 'seller_user_id'];
    const safeUpdates = {};

    for (const key of Object.keys(updates)) {
        if (allowed.includes(key)) {
            safeUpdates[key] = updates[key];
        }
    }

    if (Object.keys(safeUpdates).length === 0) {
        return res.status(400).json({ error: "Inga uppdateringar angivna" });
    }

    const { data, error } = await supabase
        .from("promo_codes")
        .update(safeUpdates)
        .eq("id", id)
        .select()
        .single();

    if (error) {
        console.error(error);
        return res.status(500).json({ error: "Kunde inte uppdatera kampanjkod" });
    }

    res.json({ success: true, promo_code: data });
});


export default router;
