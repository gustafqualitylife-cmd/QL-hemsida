# Step 1: Databas & Refactoring

## Mål
Att säkra databasstrukturen enligt specifikation och dela upp backend-koden i moduler.

## Databas (SQL att köra manuellt i Supabase)

Dessa kommandon justerar tabellerna utan att radera data.

```sql
-- 1. Skapa ENUMs för statusar (om de inte finns)
BEGIN;

DO $$ BEGIN
    CREATE TYPE booking_status_type AS ENUM (
        'new', 'assigned', 'visited', 'won', 'lost', 'cancelled', 'no_show'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status_type AS ENUM (
        'unpaid', 'paid_on_site', 'invoice_sent', 'invoice_paid'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE file_type_enum AS ENUM (
        'offer', 'before', 'after', 'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Uppdatera bookings-tabellen
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS status booking_status_type DEFAULT 'new',
ADD COLUMN IF NOT EXISTS payment_status payment_status_type DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS seller_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60;

-- 3. Uppdatera booking_files-tabellen
ALTER TABLE booking_files
ADD COLUMN IF NOT EXISTS file_type file_type_enum DEFAULT 'other',
ADD COLUMN IF NOT EXISTS uploaded_by_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS uploaded_by_role TEXT; -- 'admin' or 'seller'

COMMIT;
```

## Refactoring av Backend

Jag kommer att flytta kod från `server.js` till:
- `config/supabase.js`: Databaskoppling
- `config/openai.js`: AI-koppling
- `middleware/auth.js`: Admin-check (`requireAdmin`)
- `middleware/upload.js`: Multer-config
- `routes/public.js`: Bokning & Tider (`/api/book`, `/api/times`)
- `routes/admin.js`: Admin-endpoints
- `app.js`: Express-setup
- `server.js`: Endast start av server

Detta görs automatiskt av mig.
