# Step 2: Roller, Statusar & RLS

## Mål
Implementera säkerhet och behörighetsstyrning i databasen samt koppla på autentisering i backend.

## Databas (SQL att köra manuellt i Supabase)

Vi skapar en `profiles`-tabell för att hantera roller och säkrar upp alla tabeller med RLS (Row Level Security).

```sql
-- 1. Skapa tabell för profiler (roller)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  role TEXT CHECK (role IN ('admin', 'seller', 'user')) DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Active RLS on tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.available_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offert_ai_data ENABLE ROW LEVEL SECURITY;

-- 2. Policies för Profiles
-- Admin kan se och ändra alla profiler
CREATE POLICY "Admin CRUD profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Users kan se sin egen profil
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- 3. Policies för Bookings
-- Admin har full tillgång
CREATE POLICY "Admin full access bookings" ON public.bookings
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Säljare kan se sina TILLDELADE bokningar
CREATE POLICY "Seller view assigned bookings" ON public.bookings
  FOR SELECT TO authenticated
  USING (
    seller_user_id = auth.uid()
  );

-- Säljare kan uppdatera status på sina bokningar
CREATE POLICY "Seller update assigned bookings" ON public.bookings
  FOR UPDATE TO authenticated
  USING (
    seller_user_id = auth.uid()
  )
  WITH CHECK (
    seller_user_id = auth.uid()
  );

-- OBS: "Public" (kundvy) går via Service Role i backend, så ingen RLS behövs för anon,
-- men vi kan blockera anon access explicit för säkerhets skull.

-- 4. Policies för Booking Files
-- Admin full tillgång
CREATE POLICY "Admin full access files" ON public.booking_files
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Säljare kan se/ladda upp filer för sina bokningar
CREATE POLICY "Seller view/upload own booking files" ON public.booking_files
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings 
      WHERE id = booking_files.booking_id 
      AND seller_user_id = auth.uid()
    )
  );

-- 5. Trigger för att skapa profil automatiskt vid User Signup (Optional but recommended)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'user'); -- Default role, admin changes later
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to avoid error
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

## Backend Changes

1.  **Middleware `requireAuth`**: Ersätter/kompletterar `requireAdmin`.verifierar JWT mot Supabase Auth och hämtar roll från `profiles`.
2.  **Routes `seller.js`**: Nya endpoints för säljare (t.ex. `GET /api/seller/my-bookings`).
3.  **Routes `admin.js`**: Uppdateras för att använda den nya auth-middlewaren (vi behåller `requireAdmin` som en legacy/dev key fallback eller migrerar helt). *För detta steg inför vi `requireSupabaseRole('admin')`.*

Jag kommer skapa filerna för detta nu.
