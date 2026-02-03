import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import publicRoutes from "./routes/public.js";
import adminRoutes from "./routes/admin.js";
import sellerRoutes from "./routes/seller.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/admin", adminRoutes);
app.use("/api/seller", sellerRoutes);
app.use("/api", publicRoutes);

// Health check
app.get("/", (req, res) => {
    res.send("QualityLife Backend Running");
});

export default app;
