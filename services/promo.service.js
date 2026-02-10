import supabase from "../config/supabase.js";

// Hardcoded prices for v1 as requested (source of truth is backend)
const SERVICE_PRICES = {
    "mattvätt": 1500,
    "möbeltvätt": 1500, // Assuming same base for simple setup, or we default to 1500 if unknown. 
    // Spec only mentioned "Mattvätt: 1500". 
    // Spec also said "Kampanjkoden ska kunna användas för: mattvätt, möbeltvätt, madrasstvätt"
    // and "Du ska implementera så att systemet kan hantera att varje tjänst har sitt ordinarie pris."
    // I will add placeholders.
    "madrasstvätt": 1500
};

const DEFAULT_PRICE = 1500;

/**
 * Get base price for a service
 */
export const getBasePrice = (serviceName) => {
    if (!serviceName) return DEFAULT_PRICE;
    const key = serviceName.toLowerCase().trim();
    return SERVICE_PRICES[key] || DEFAULT_PRICE;
};

/**
 * Validate promo code
 * Returns { valid: bool, code: string, discount_percent: int, id: uuid, reason: string }
 */
export const validatePromoCode = async (code, sellerUserId = null) => {
    if (!code) return { valid: false, reason: "No code provided" };

    const normalizedCode = code.trim().toUpperCase();

    const { data: promo, error } = await supabase
        .from("promo_codes")
        .select("*")
        .eq("code", normalizedCode)
        .single();

    if (error || !promo) {
        return { valid: false, reason: "not_found" };
    }

    if (!promo.active) {
        return { valid: false, reason: "inactive" };
    }

    const now = new Date();
    if (promo.starts_at && new Date(promo.starts_at) > now) {
        return { valid: false, reason: "not_started" };
    }
    if (promo.ends_at && new Date(promo.ends_at) < now) {
        return { valid: false, reason: "expired" };
    }

    // Global codes have null seller_user_id.
    // Seller specific codes must match the provided sellerUserId.
    // Requirement v1: "Endast globala promo codes i v1... Kundflödet ska kunna skicka promo_code utan seller_user_id"
    // STRICT CHECK: If promo has a seller_id, and we didn't provide one (or provided mismatched), it's invalid.
    if (promo.seller_user_id) {
        if (!sellerUserId || promo.seller_user_id !== sellerUserId) {
            return { valid: false, reason: "seller_mismatch" };
        }
    }

    // Usage limit check (preliminary, real check is atomic increment)
    if (promo.usage_limit !== null && promo.usage_count >= promo.usage_limit) {
        return { valid: false, reason: "usage_limit_reached" };
    }

    return {
        valid: true,
        code: normalizedCode,
        id: promo.id,
        discount_percent: promo.discount_percent
    };
};

/**
 * Calculate final price
 */
export const calculatePrice = (basePrice, discountPercent) => {
    if (!discountPercent) return { finalPrice: basePrice, discountAmount: 0 };
    const discountAmount = Math.round(basePrice * (discountPercent / 100));
    const finalPrice = basePrice - discountAmount;
    return { finalPrice, discountAmount };
};

/**
 * Increment usage count safely
 * Returns { success: bool }
 */
export const incrementUsage = async (promoCodeId) => {
    // 1. Check if usage limit is reached
    const { data: promo, error: getError } = await supabase
        .from("promo_codes")
        .select("usage_count, usage_limit")
        .eq("id", promoCodeId)
        .single();

    if (getError || !promo) return { success: false };
    if (promo.usage_limit !== null && promo.usage_count >= promo.usage_limit) {
        return { success: false };
    }

    // 2. Call RPC to increment
    const { error: rpcError } = await supabase.rpc("increment_promo_usage", { row_id: promoCodeId });
    if (rpcError) return { success: false };

    return { success: true };
};
