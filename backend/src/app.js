import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import userRoutes from "./routes/users.routes.js";

const app = express();

// MIDDLEWARE
app.use(cors());
app.use(express.json());

// ROUTES
app.use("/api/users", userRoutes);

// Root test
app.get("/", (req, res) => {
  res.json({ message: "Backend running 🚀" });
});

// EXPORT
export default app;
