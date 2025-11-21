import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";

import userRoutes from "./routes/users.routes.js";
import historyRoutes from "./routes/history.routes.js";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect DB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log("MongoDB error:", err));

// FIXED API ROUTES (MATCH FRONTEND)
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/history", historyRoutes);

// Root test
app.get("/", (req, res) => {
  res.json({ message: "Backend running 🚀" });
});

export default app;
