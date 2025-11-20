// backend/src/app.js
import express from "express";
import { createServer } from "node:http";
import mongoose from "mongoose";
import cors from "cors";
import userRoutes from "./routes/users.routes.js";
import { connectToSocket } from "./controllers/socketManager.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// -------- CORS FIX --------
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

app.use(express.json());

// -------- ROUTES --------
app.use("/api/v1/users", userRoutes);

// -------- HEALTH CHECK --------
app.get("/", (req, res) => {
  res.send("Gup-Shap Backend running ✅");
});

// -------- SERVER --------
const server = createServer(app);

// -------- SOCKET.IO --------
connectToSocket(server); // FIX: removed invalid args

// -------- PORT --------
const PORT = process.env.PORT || 8000;

async function start() {
  try {
    if (process.env.MONGO_URI) {
      await mongoose.connect(process.env.MONGO_URI);
      console.log("Connected to MongoDB");
    } else {
      console.log("⚠ MONGO_URI missing — running without database");
    }

    server.listen(PORT, () => {
      console.log("Backend started on PORT", PORT);
    });
  } catch (err) {
    console.error("❌ Backend crash", err);
    process.exit(1);
  }
}

start();
