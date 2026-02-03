-- SQL for Campaign Codes Implementation (v1 Global)

-- 1. Create promo_codes table
CREATE TABLE IF NOT EXISTS promo_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL,
    seller_user_id uuid REFERENCES auth.users(id), -- Nullable for Global Codes
    discount_percent int DEFAULT 50,
    active boolean DEFAULT true,
    starts_at timestamptz,
    ends_at timestamptz,
    usage_limit int,
    usage_count int DEFAULT 0,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    notes text
);

-- Unique index on code
CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_codes_code_unique ON promo_codes (code);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_promo_codes_seller ON promo_codes (seller_user_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes (active);

-- 2. Update bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS base_price_sek int,
ADD COLUMN IF NOT EXISTS discount_percent int,
ADD COLUMN IF NOT EXISTS final_price_sek int,
ADD COLUMN IF NOT EXISTS promo_code text, -- Stores the code used at booking time
ADD COLUMN IF NOT EXISTS promo_code_id uuid REFERENCES promo_codes(id);

-- 3. (Optional but good practice) Add explicit services table if not exists?
-- For now, we are keeping it simple as per spec instructions (Backend holds source of truth for base prices)

-- Comments:
-- promo_codes.seller_user_id IS NULL implies a global code.
-- bookings.final_price_sek is the source of truth for what was charged.
