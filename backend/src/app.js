// backend/src/app.js
import express from "express";
import { createServer } from "node:http";
import mongoose from "mongoose";
import cors from "cors";
import userRoutes from "./routes/users.routes.js";
import { connectToSocket } from "./controllers/socketManager.js";

const app = express();

// ---------------------------
// CORS FIX for Render + Vercel/Netlify
// ---------------------------
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

app.use(express.json());

// ---------------------------
// API ROUTES
// ---------------------------
app.use("/api/v1/users", userRoutes);

// ---------------------------
// HEALTH CHECK (Fix for 503 error)
// ---------------------------
app.get("/", (req, res) => {
  res.send("Gup-Shap Backend is running ✅");
});

// ---------------------------
// SERVER + SOCKET
// ---------------------------
const server = createServer(app);

// Important: allow socket.io to stay alive on Render
const io = connectToSocket(server, {
  pingTimeout: 20000,
  pingInterval: 25000,
});

// ---------------------------
// PORT FIX for Render
// ---------------------------
const PORT = process.env.PORT || 8000;

async function start() {
  try {
    if (process.env.MONGO_URI) {
      await mongoose.connect(process.env.MONGO_URI);
      console.log("Connected to MongoDB");
    } else {
      console.log("MONGO_URI not set — running without DB");
    }

    server.listen(PORT, () => {
      console.log(`Backend running on PORT ${PORT}`);
    });
  } catch (err) {
    console.error("Backend failed to start:", err);
    process.exit(1);
  }
}

start();
