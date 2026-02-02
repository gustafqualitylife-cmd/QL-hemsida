import supabase from "../config/supabase.js";

// Middleware för att verifiera JWT och hämta användarprofil
export async function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing authorization token" });
    }

    const token = header.split(" ")[1];

    // 1. Verifiera token med Supabase Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
        return res.status(401).json({ error: "Invalid token" });
    }

    // 2. Hämta roll från profiles-tabellen
    // Eftersom vi använder Service Role Client i backend, måste vi manuellt kolla rollen
    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    if (profileError || !profile) {
        // Om ingen profil finns (kanske skapad innan triggers?), anta 'user' eller neka
        // Vi nekar för säkerhets skull
        return res.status(403).json({ error: "User profile not found" });
    }

    // Spara user och profile i request-objektet för nästa steg
    req.user = user;
    req.profile = profile;

    next();
}

// Helper för att kräva specifik roll
export function requireRole(requiredRole) {
    return (req, res, next) => {
        if (!req.profile || req.profile.role !== requiredRole) {
            return res.status(403).json({ error: `Forbidden: Requires ${requiredRole} role` });
        }
        next();
    };
}
