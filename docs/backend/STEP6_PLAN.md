# Steg 6: Filhantering och Uppladdning

## Mål
Säkerställa robust filuppladdning för både Admin och Säljare, med stöd för korrekta filtyper (`offer`, `before`, `after`, `other`).

## Supabase Storage (Manuell åtgärd)
Du måste skapa en bucket i Supabase om den inte finns.

1.  Gå till **Storage** i Supabase Dashboard.
2.  Skapa en bucket med namnet: `booking-files`.
3.  Sätt den som **Private** (viktigt! vi använder RLS).
4.  Ladda om sidan för att se policys. (Vi har redan lagt RLS för `booking_files`-tabellen, men Storage har egna Policies).

**Storage Policies (SQL att köra):**
För att RLS ska funka mot Storage måste vi ge rätigheter.

```sql
-- Tillåt inloggade att ladda upp till 'booking-files'
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'booking-files');

-- Tillåt inloggade att se filer i 'booking-files'
CREATE POLICY "Authenticated users can select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'booking-files');

-- (Man kan göra detta mer granulärt, men tabellen booking_files styr vem som har "referensen", 
-- så detta är en OK grundnivå).
```

## Backend Changes

Jag kommer uppdatera `routes/admin.js` och `routes/seller.js` för att:
1.  Läsa `req.body.file_type` vid upload.
2.  Validera att `file_type` är en av: `['offer', 'before', 'after', 'other']`.
3.  Standardisera felhanteringen.

Detta gör att säljare kan ladda upp "Före-bild" eller "Offert" och det loggas korrekt.
