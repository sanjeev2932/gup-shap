// -------- ENV MUST LOAD FIRST --------
import dotenv from "dotenv";
dotenv.config();

// -------- IMPORTS --------
import express from "express";
import { createServer } from "node:http";
import mongoose from "mongoose";
import cors from "cors";
import userRoutes from "./routes/users.routes.js";
import { connectToSocket } from "./controllers/socketManager.js";

// -------- APP --------
const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

app.use(express.json());

// -------- ROUTES --------
app.use("/api/v1/users", userRoutes);

// health check
app.get("/", (req, res) => {
  res.send("Gup-Shap Backend running ✅");
});

// -------- SERVER + SOCKET --------
const server = createServer(app);
connectToSocket(server);

// -------- PORT --------
const PORT = process.env.PORT || 8000;

// -------- START SERVER --------
async function start() {
  try {
    if (process.env.MONGO_URI) {
      await mongoose.connect(process.env.MONGO_URI);
      console.log("Connected to MongoDB");
    } else {
      console.log("⚠ MONGO_URI missing — running without DB");
    }

    server.listen(PORT, () =>
      console.log("Backend started on PORT", PORT)
    );
  } catch (err) {
    console.error("❌ Backend crash", err);
    process.exit(1);
  }
}

start();
