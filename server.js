import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ---- Supabase client ----
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // service role key i backend
);

// ---- Enkel admin-koll ----
function requireAdmin(req, res) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing admin token" });
    return false;
  }
  const token = header.split(" ")[1];
  if (token !== process.env.ADMIN_SECRET) {
    res.status(403).json({ error: "Invalid admin token" });
    return false;
  }
  return true;
}

// -----------------------------------------------------------
// PUBLIC: Hämta lediga tider
// -----------------------------------------------------------
app.get("/api/times", async (req, res) => {
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
app.post("/api/book", async (req, res) => {
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
        // 👇 EXAKT samma värde som du skickar till Google Sheets
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
      // Viktigt: vi låter ändå bokningen vara lyckad även om webhooken failar
    }
  } else {
    console.warn("Ingen APPS_SCRIPT_WEBHOOK_URL satt i .env");
  }

  // 5. Svar tillbaka till frontend
  res.json({ success: true, message: "Bokning klar" });
});

// -----------------------------------------------------------
// ADMIN: Lägg till ny ledig tid
// body: { start_time }  (ISO-sträng, t.ex. 2025-11-20T10:00:00Z)
// -----------------------------------------------------------
app.post("/api/admin/times", async (req, res) => {
  if (!requireAdmin(req, res)) return;

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
app.delete("/api/admin/times/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const id = req.params.id;

  // Ta bara bort om den inte är bokad
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
app.get("/api/admin/bookings", async (req, res) => {
  if (!requireAdmin(req, res)) return;

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
// form-data: field "file"
// -----------------------------------------------------------
app.post(
  "/api/admin/bookings/:id/files",
  (req, res, next) => {
    if (!requireAdmin(req, res)) return;
    next();
  },
  upload.single("file"),
  async (req, res) => {
    const bookingId = req.params.id;

    if (!req.file) {
      return res.status(400).json({ error: "Ingen fil mottagen. Använd field 'file'." });
    }

    try {
      const file = req.file;
      const fileExt = file.originalname.split(".").pop();
      const safeName = file.originalname.replace(/\s+/g, "_");
      const filePath = `${bookingId}/${Date.now()}-${safeName}`;

      // 1) Ladda upp till Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("booking-files")
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });

      if (uploadError) {
        console.error("Upload error from Supabase Storage:", uploadError);
        return res.status(500).json({
          error:
            uploadError.message ||
            uploadError.error ||
            "Kunde inte ladda upp filen (okänt storage-fel)"
        });
      }

      // 2) Hämta public URL
      const { data: publicUrlData } = supabase.storage
        .from("booking-files")
        .getPublicUrl(uploadData.path);

      const fileUrl = publicUrlData.publicUrl;

      // 3) Spara rad i booking_files
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

      res.json({
        success: true,
        file: inserted
      });
    } catch (err) {
      console.error("Fel vid fil-upload:", err);
      res.status(500).json({ error: "Tekniskt fel vid fil-upload" });
    }
  }
);
// -----------------------------------------------------------
// ADMIN: Hämta filer för en specifik bokning
// -----------------------------------------------------------
app.get("/api/admin/bookings/:id/files", async (req, res) => {
  if (!requireAdmin(req, res)) return;

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
// ADMIN: AI-offertanalys (skelett, utan AI än)
// -----------------------------------------------------------
app.post(
  "/api/admin/bookings/:id/offer-ai",
  (req, res, next) => {
    if (!requireAdmin(req, res)) return;
    next();
  },
  upload.single("file"),
  async (req, res) => {
    const bookingId = req.params.id;

    if (!req.file) {
      return res.status(400).json({ error: "Ingen fil mottagen." });
    }

    try {
      const file = req.file;
      const safeName = file.originalname.replace(/\s+/g, "_");
      const filePath = `${bookingId}/offer-${Date.now()}-${safeName}`;

      // 1. Ladda upp fil till Supabase Storage
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

      // 2. Hämta public URL
      const { data: publicUrlData } = supabase.storage
        .from("booking-files")
        .getPublicUrl(uploadData.path);

      const fileUrl = publicUrlData.publicUrl;

      // 3. Här ska OCR & AI ske senare
      // Just nu returnerar vi bara att filen laddats upp
      res.json({
        success: true,
        message: "Offertfil uppladdad – AI-tolkning implementeras i nästa steg.",
        file_url: fileUrl
      });

    } catch (err) {
      console.error("Fel i AI-offert-route:", err);
      res.status(500).json({ error: "Tekniskt fel vid offertupload" });
    }
  }
);


// -----------------------------------------------------------
// START SERVER
// -----------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
