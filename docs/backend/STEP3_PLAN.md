# Step 3: Race-safe Bokning

## Mål
Förhindra dubbelbokningar genom att göra bokningsprocessen atomär i databasen.

## Databas (SQL att köra manuellt i Supabase)

Vi skapar en lagrad procedur (RPC) som hanterar hela bokningsflödet i en transaktion.

```sql
-- Skapa en funktion för att boka säkert
CREATE OR REPLACE FUNCTION public.book_time_slot(
  p_time_id UUID,
  p_name TEXT,
  p_address TEXT,
  p_phone TEXT,
  p_email TEXT,
  p_seller_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Körs med skaparens behörigheter (admin-ish för att kunna skriva)
AS $$
DECLARE
  v_time_record public.available_times%ROWTYPE;
  v_booking_id UUID;
  v_start_time TIMESTAMPTZ;
BEGIN
  -- 1. Lås raden i available_times och kolla om den är ledig
  -- FOR UPDATE ser till att ingen annan kan läsa/ändra denna rad samtidigt
  SELECT * INTO v_time_record
  FROM public.available_times
  WHERE id = p_time_id
  FOR UPDATE;

  -- 2. Validera att tiden finns
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Time slot not found');
  END IF;

  -- 3. Validera att den inte är bokad
  IF v_time_record.is_booked THEN
    RETURN jsonb_build_object('success', false, 'error', 'Time slot already booked');
  END IF;

  v_start_time := v_time_record.start_time;

  -- 4. Markera som bokad
  UPDATE public.available_times
  SET is_booked = true
  WHERE id = p_time_id;

  -- 5. Skapa bokningen
  INSERT INTO public.bookings (
    time_id,
    name,
    address,
    phone,
    email,
    seller_name,
    start_time,
    status
  ) VALUES (
    p_time_id,
    p_name,
    p_address,
    p_phone,
    p_email,
    p_seller_name,
    v_start_time,
    'new'
  )
  RETURNING id INTO v_booking_id;

  -- 6. Returnera framgång
  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'start_time', v_start_time
  );

EXCEPTION WHEN OTHERS THEN
  -- Vid fel rullas allt tillbaka automatiskt
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
```

## Backend Changes

Jag uppdaterar `routes/public.js` för att anropa `rpc('book_time_slot', ...)` istället för att göra logiken i flera steg.

### Fördelar:
1.  **Atomär:** Ingen annan kan knycka tiden mellan "check" och "update".
2.  **Säker:** Data-integriteten garanteras av databasen.
3.  **Enklare backend:** Vi flyttar affärslogik närmare datan.
