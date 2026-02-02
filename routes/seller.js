import express from "express";
import supabase from "../config/supabase.js";
import { requireAuth, requireRole } from "../middleware/requireAuth.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// Alla routes här kräver att man är inloggad som 'seller' (eller admin)
// Vi sätter requireAuth först, sen requireRole('seller')
// OBS: Admin bör kanske också komma åt sälj-routes?
// Enklast: Om man är admin får man också passera, men vi börjar strikt med 'seller'.
// Eller vi tillåter 'seller' och 'admin'.

router.use(requireAuth);

function requireSellerOrAdmin(req, res, next) {
    const role = req.profile.role;
    if (role === 'seller' || role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: "Access denied. Seller role required." });
    }
}

router.use(requireSellerOrAdmin);

// -----------------------------------------------------------
// SÄLJARE: Hämta sina tilldelade bokningar
// -----------------------------------------------------------
router.get("/my-bookings", async (req, res) => {
    const userId = req.user.id;

    const { data, error } = await supabase
        .from("bookings")
        .select(`
      id, time_id, name, address, phone, email, 
      seller_name, start_time, status, payment_status,
      created_at
    `)
        .eq("seller_user_id", userId)
        .order("start_time", { ascending: true });

    if (error) {
        console.error(error);
        return res.status(500).json({ error: "Could not fetch bookings" });
    }

    res.json(data || []);
});

// -----------------------------------------------------------
// SÄLJARE: Uppdatera status på en bokning (t.ex. 'visited', 'won')
// -----------------------------------------------------------
router.patch("/bookings/:id/status", async (req, res) => {
    const userId = req.user.id;
    const bookingId = req.params.id;
    const { status } = req.body;

    // Validera status
    const allowedStatuses = ['new', 'assigned', 'visited', 'won', 'lost', 'cancelled', 'no_show'];
    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
    }

    // Se till att bokningen tillhör säljaren innan uppdatering
    // (Detta görs redundant av RLS i DB men bra att ha i backend också för tydliga fel)
    const { data, error } = await supabase
        .from("bookings")
        .update({ status })
        .eq("id", bookingId)
        .eq("seller_user_id", userId) // Säkerställer ägarskap
        .select();

    if (error) {
        console.error(error);
        return res.status(500).json({ error: "Could not update status" });
    }

    if (data.length === 0) {
        return res.status(404).json({ error: "Booking not found or not assigned to you" });
    }

    res.json({ success: true, booking: data[0] });
});

// -----------------------------------------------------------
// SÄLJARE: Ladda upp fil (t.ex. offertbild)
// -----------------------------------------------------------
router.post("/bookings/:id/files", upload.single("file"), async (req, res) => {
    const userId = req.user.id;
    const bookingId = req.params.id;

    if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
    }

    // Verifiera först att säljaren äger bokningen
    const { data: booking, error: checkError } = await supabase
        .from("bookings")
        .select("id")
        .eq("id", bookingId)
        .eq("seller_user_id", userId)
        .single();

    if (checkError || !booking) {
        return res.status(403).json({ error: "Booking not found or access denied" });
    }

    // Upload
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
                    uploaded_by_user_id: userId,
                    uploaded_by_role: 'seller',
                    file_type: 'offer' // Default or passed in body? Defaulting to offer for now
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

export default router;
