import express from "express";
import supabase from "../config/supabase.js";
import openai from "../config/openai.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// Alla admin-routes kräver admin-token
router.use(requireAdmin);

// -----------------------------------------------------------
// ADMIN: Lägg till ny ledig tid
// -----------------------------------------------------------
router.post("/times", async (req, res) => {
    const { start_time } = req.body;

    if (!start_time) {
        return res.status(400).json({ error: "start_time krävs" });
    }

    const { error } = await supabase
        .from("available_times")
        .insert([{ start_time }]);

    if (error) {
        console.error(error);
        return res.status(500).json({ error: "Kunde inte skapa tiden" });
    }

    res.json({ success: true, message: "Tid tillagd" });
});

// -----------------------------------------------------------
// ADMIN: Ta bort en ledig tid (endast om den inte är bokad)
// -----------------------------------------------------------
router.delete("/times/:id", async (req, res) => {
    const id = req.params.id;

    const { error } = await supabase
        .from("available_times")
        .delete()
        .eq("id", id)
        .eq("is_booked", false);

    if (error) {
        console.error(error);
        return res.status(500).json({ error: "Kunde inte ta bort tiden" });
    }

    res.json({ success: true, message: "Tid borttagen (om den var obokad)" });
});

// -----------------------------------------------------------
// ADMIN: Hämta bokningar (inkl. besökstid/start_time)
// -----------------------------------------------------------
router.get("/bookings", async (req, res) => {
    const { data, error } = await supabase
        .from("bookings")
        .select(
            "id, time_id, name, address, phone, email, created_at, seller_name, start_time"
        )
        .order("created_at", { ascending: false });

    if (error) {
        console.error(error);
        return res.status(500).json({ error: "Kunde inte hämta bokningar" });
    }

    res.json(data || []);
});

// -----------------------------------------------------------
// ADMIN: Ladda upp fil kopplad till en bokning
// -----------------------------------------------------------
router.post("/bookings/:id/files", upload.single("file"), async (req, res) => {
    const bookingId = req.params.id;

    if (!req.file) {
        return res.status(400).json({ error: "Ingen fil mottagen. Använd field 'file'." });
    }

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
            console.error(uploadError);
            return res.status(500).json({ error: "Kunde inte ladda upp filen" });
        }

        const { data: publicUrlData } = supabase.storage
            .from("booking-files")
            .getPublicUrl(uploadData.path);

        const fileUrl = publicUrlData.publicUrl;

        const { data: inserted, error: insertError } = await supabase
            .from("booking_files")
            .insert([
                {
                    booking_id: bookingId,
                    file_name: file.originalname,
                    file_url: fileUrl
                }
            ])
            .select()
            .single();

        if (insertError) {
            console.error(insertError);
            return res
                .status(500)
                .json({ error: "Filen laddades upp, men kunde inte sparas i databasen" });
        }

        // Call AI analysis
        try {
            const apiUrl = process.env.API_BASE_URL || "http://localhost:3000";
            await fetch(
                `${apiUrl}/api/admin/bookings/${bookingId}/offer-ai/analyze`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${process.env.ADMIN_SECRET}`
                    },
                    body: JSON.stringify({ file_url: fileUrl })
                }
            );
        } catch (aiErr) {
            console.error("AI-analys misslyckades request (men filen finns kvar):", aiErr);
        }

        res.json({
            success: true,
            message: "Offertfil uppladdad. AI-analys körs i bakgrunden.",
            file_url: fileUrl
        });
    } catch (err) {
        console.error("Fel vid fil-upload:", err);
        res.status(500).json({ error: "Tekniskt fel vid fil-upload" });
    }
});

// -----------------------------------------------------------
// ADMIN: Hämta filer för en specifik bokning
// -----------------------------------------------------------
router.get("/bookings/:id/files", async (req, res) => {
    const bookingId = req.params.id;

    const { data, error } = await supabase
        .from("booking_files")
        .select("id, file_name, file_url, created_at")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error(error);
        return res.status(500).json({ error: "Kunde inte hämta filer" });
    }

    res.json(data || []);
});

// -----------------------------------------------------------
// ADMIN: AI-offertanalys (skelett / legacy wrapper för upload)
// -----------------------------------------------------------
router.post("/bookings/:id/offer-ai", upload.single("file"), async (req, res) => {
    const bookingId = req.params.id;

    if (!req.file) {
        return res.status(400).json({ error: "Ingen fil mottagen." });
    }

    try {
        const file = req.file;
        const safeName = file.originalname.replace(/\s+/g, "_");
        const filePath = `${bookingId}/offer-${Date.now()}-${safeName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from("booking-files")
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (uploadError) {
            console.error(uploadError);
            return res.status(500).json({ error: "Kunde inte ladda upp offertfilen" });
        }

        const { data: publicUrlData } = supabase.storage
            .from("booking-files")
            .getPublicUrl(uploadData.path);

        const fileUrl = publicUrlData.publicUrl;

        res.json({
            success: true,
            message: "Offertfil uppladdad – AI-tolkning implementeras i nästa steg.",
            file_url: fileUrl
        });

    } catch (err) {
        console.error("Fel i AI-offert-route:", err);
        res.status(500).json({ error: "Tekniskt fel vid offertupload" });
    }
});

// -----------------------------------------------------------
// ADMIN: AI-analys av offertbild
// -----------------------------------------------------------
router.post("/bookings/:id/offer-ai/analyze", async (req, res) => {
    const bookingId = req.params.id;
    const { file_url } = req.body;

    if (!file_url) {
        return res.status(400).json({ error: "file_url saknas" });
    }

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content:
                        "Du tolkar fotade offerter från företaget QualityLife. " +
                        "Returnera ALLTID ENBART giltig JSON, utan förklaringar, utan backticks."
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `
Du får en bild på en offert från QualityLife.

1) Läs all text på offerten.
2) Identifiera:
   - kundens namn (NAMN)
   - adress (ADRESS)
   - mejl (MEJL)
   - telefon (TELEFON)
   - datum & tid (DATUM & TID)
   - rader i prislistan (Madrass, Matta/kvm, Soffa, etc.) med pris, antal, totalt
   - totala beloppet (Att betala)
   - RUT-avdrag om det finns
3) Returnera ENBART JSON med följande format:

{
  "ocr_text": "...all läsbar text från offerten...",
  "structured": {
    "customer_name": "",
    "address": "",
    "email": "",
    "phone": "",
    "visit_datetime": "",
    "items": [
      { "service": "Madrass", "unit_price": 1200, "quantity": 1, "total": 1200 }
    ],
    "extra_costs": [
      { "label": "Utkörning, maskinhyra, medel, etc", "amount": 500 }
    ],
    "rut_deduction": 0,
    "total": 0
  }
}

Fyll i så gott du kan. Svara ENBART med JSON, inga kommentarer.
              `
                        },
                        {
                            type: "image_url",
                            image_url: { url: file_url }
                        }
                    ]
                }
            ]
        });

        const content = completion.choices?.[0]?.message?.content?.trim();
        if (!content) {
            return res.status(500).json({ error: "Tomt svar från AI-modellen" });
        }

        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch (err) {
            console.error("Kunde inte pars:a AI-svar som JSON:", content);
            return res
                .status(500)
                .json({ error: "AI-svaret var inte giltig JSON", raw: content });
        }

        const rawText = parsed.ocr_text || null;
        const structured = parsed.structured || parsed;

        const { data: aiRow, error: aiError } = await supabase
            .from("offert_ai_data")
            .insert([
                {
                    booking_id: bookingId,
                    raw_text: rawText,
                    json_data: structured
                }
            ])
            .select()
            .single();

        if (aiError) {
            console.error(aiError);
            return res
                .status(500)
                .json({ error: "Kunde inte spara AI-data i offert_ai_data" });
        }

        // Update booking fields if found
        const bookingUpdate = {};
        if (structured.customer_name) bookingUpdate.offer_customer_name = structured.customer_name;
        if (structured.address) bookingUpdate.offer_customer_address = structured.address;
        if (structured.email) bookingUpdate.offer_customer_email = structured.email;
        if (structured.phone) bookingUpdate.offer_customer_phone = structured.phone;
        if (structured.visit_datetime) bookingUpdate.offer_visit_time = structured.visit_datetime;
        if (typeof structured.total === "number" && !Number.isNaN(structured.total)) {
            bookingUpdate.offer_amount = structured.total;
        }

        if (Object.keys(bookingUpdate).length > 0) {
            const { error: bookingUpdateError } = await supabase
                .from("bookings")
                .update(bookingUpdate)
                .eq("id", bookingId);

            if (bookingUpdateError) {
                console.error("Kunde inte uppdatera bookings med offertdata:", bookingUpdateError);
            }
        }

        res.json({
            success: true,
            message: "AI-analys klar",
            ai: aiRow
        });
    } catch (err) {
        console.error("Fel i offer-ai/analyze:", err);
        res.status(500).json({
            error: "Tekniskt fel vid AI-analys",
            detail: err.message
        });
    }
});

// -----------------------------------------------------------
// ADMIN: Hämta senaste AI-offertanalys
// -----------------------------------------------------------
router.get("/bookings/:id/offer-ai", async (req, res) => {
    const bookingId = req.params.id;

    const { data, error } = await supabase
        .from("offert_ai_data")
        .select("id, booking_id, raw_text, json_data, created_at")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: false })
        .limit(1);

    if (error) {
        console.error(error);
        return res.status(500).json({ error: "Kunde inte hämta AI-data" });
    }

    if (!data || data.length === 0) {
        return res.json({ ai: null });
    }

    return res.json({ ai: data[0] });
});

export default router;
