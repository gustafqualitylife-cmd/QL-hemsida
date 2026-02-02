import dotenv from "dotenv";
dotenv.config();

export function requireAdmin(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing admin token" });
    }
    const token = header.split(" ")[1];
    if (token !== process.env.ADMIN_SECRET) {
        return res.status(403).json({ error: "Invalid admin token" });
    }
    next();
}
