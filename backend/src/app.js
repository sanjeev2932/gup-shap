// backend/src/app.js
import express from "express";
import { createServer } from "node:http";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";

import userRoutes from "./routes/users.routes.js";
import { connectToSocket } from "./controllers/socketManager.js";

dotenv.config();

const app = express();
app.use(cors({
  origin: "*",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// health
app.get("/", (req, res) => res.json({ status: "ok" }));

app.use("/api/v1/users", userRoutes);

// create HTTP server and attach socket.io
const server = createServer(app);
connectToSocket(server);

const PORT = process.env.PORT || 8000;

async function start() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.warn("MONGO_URI not set - skipping Mongo connect (if you need DB, set MONGO_URI).");
    } else {
      await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      console.log("MongoDB connected:", mongoose.connection.host);
    }

    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("Startup error:", err);
    process.exit(1);
  }
}

start();
