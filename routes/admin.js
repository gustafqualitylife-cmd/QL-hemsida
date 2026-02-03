import express from "express";
import supabase from "../config/supabase.js";
import openai from "../config/openai.js";
import { requireAuth, requireRole } from "../middleware/requireAuth.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// Require admin role
router.use(requireAuth);
router.use(requireRole('admin'));

// -----------------------------------------------------------
// BOOKINGS
// -----------------------------------------------------------
router.get("/bookings", async (req, res) => {
    const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Admin bookings error:", error);
        return res.status(500).json({ error: "Kunde inte hämta bokningar" });
    }
    res.json(data || []);
});

router.get("/bookings/:id", async (req, res) => {
    const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", req.params.id)
        .single();

    if (error) {
        console.error("Admin booking detail error:", error);
        return res.status(500).json({ error: "Kunde inte hämta bokning" });
    }
    if (!data) return res.status(404).json({ error: "Bokning saknas" });

    const { data: files } = await supabase
        .from("booking_files")
        .select("*")
        .eq("booking_id", req.params.id);

    data.files = files || [];
    res.json(data);
});

router.patch("/bookings/:id/assign", async (req, res) => {
    const { seller_user_id, seller_name } = req.body;
    const { data, error } = await supabase
        .from("bookings")
        .update({
            seller_user_id,
            seller_name: seller_name || null,
            status: 'assigned'
        })
        .eq("id", req.params.id)
        .select()
        .single();

    if (error) {
        console.error(error);
        return res.status(500).json({ error: "Kunde inte tilldela säljare" });
    }
    res.json({ success: true, booking: data });
});

router.patch("/bookings/:id", async (req, res) => {
    const updates = req.body;
    const allowed = {};
    if (updates.status) allowed.status = updates.status;
    if (updates.payment_status) allowed.payment_status = updates.payment_status;

    if (Object.keys(allowed).length === 0) return res.status(400).json({ error: "Inga fält" });

    const { data, error } = await supabase
        .from("bookings")
        .update(allowed)
        .eq("id", req.params.id)
        .select()
        .single();

    if (error) {
        console.error(error);
        return res.status(500).json({ error: "Kunde inte uppdatera" });
    }
    res.json({ success: true, booking: data });
});

// -----------------------------------------------------------
// UPLOAD
// -----------------------------------------------------------
router.post("/bookings/:id/files", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Ingen fil" });
    const { file_type } = req.body;

    try {
        const file = req.file;
        const filePath = `${req.params.id}/${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from("booking-files")
            .upload(filePath, file.buffer, { contentType: file.mimetype });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
            .from("booking-files")
            .getPublicUrl(uploadData.path);

        const { data: fileRow, error: dbError } = await supabase
            .from("booking_files")
            .insert([{
                booking_id: req.params.id,
                file_name: file.originalname,
                file_url: publicUrlData.publicUrl,
                uploaded_by_user_id: req.user.id,
                uploaded_by_role: 'admin',
                file_type: file_type || 'other'
            }])
            .select().single();

        if (dbError) throw dbError;
        res.json({ success: true, file: fileRow });
    } catch (err) {
        console.error("Admin Upload error:", err);
        res.status(500).json({ error: "Upload failed: " + err.message });
    }
});

// -----------------------------------------------------------
// SELLERS
// -----------------------------------------------------------
router.get("/sellers", async (req, res) => {
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
// TIMES
// -----------------------------------------------------------
router.get("/times", async (req, res) => {
    const { data, error } = await supabase
        .from("available_times")
        .select("*")
        .order("start_time", { ascending: true });
    res.json(data || []);
});

router.post("/times", async (req, res) => {
    const { start_time } = req.body;
    const { error } = await supabase.from("available_times").insert([{ start_time }]);
    if (error) return res.status(500).json({ error: "Fel vid skapande" });
    res.json({ success: true });
});

router.delete("/times/:id", async (req, res) => {
    const { error } = await supabase.from("available_times").delete().eq("id", req.params.id).eq("is_booked", false);
    if (error) return res.status(500).json({ error: "Fel vid radering" });
    res.json({ success: true });
});

// -----------------------------------------------------------
// PROMOS
// -----------------------------------------------------------
router.get("/promo-codes", async (req, res) => {
    const { data, error } = await supabase.from("promo_codes").select("*").order("created_at", { ascending: false });
    res.json(data || []);
});

router.post("/promo-codes", async (req, res) => {
    const { code, discount_percent, active, usage_limit } = req.body;
    const { data, error } = await supabase.from("promo_codes").insert([{
        code: code.trim().toUpperCase(),
        discount_percent: discount_percent || 50,
        active: active !== undefined ? active : true,
        usage_limit: usage_limit || null,
        created_by: req.user.id
    }]).select().single();
    if (error) return res.status(500).json({ error: "Fel vid skapande" });
    res.json({ success: true, promo_code: data });
});

router.patch("/promo-codes/:id", async (req, res) => {
    const { data, error } = await supabase.from("promo_codes").update(req.body).eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: "Fel vid uppdatering" });
    res.json({ success: true, promo_code: data });
});

export default router;
