import express from "express";
import { createServer } from "node:http";
import mongoose from "mongoose";
import cors from "cors";

import userRoutes from "./routes/users.routes.js";
import { connectToSocket } from "./controllers/socketManager.js";

const app = express();
const server = createServer(app);

// attach socket.io to the server
connectToSocket(server);

// middleware
app.use(cors());
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

// API routes
app.use("/api/v1/users", userRoutes);

// start server + DB
const start = async () => {
  try {
    const connectionDb = await mongoose.connect(
      "mongodb+srv://sanjeev2932005_db_user:Eazy637@cluster0.k8xo7ih.mongodb.net/"
    );

    console.log(`MONGO Connected: ${connectionDb.connection.host}`);

    const PORT = process.env.PORT || 8000;

    server.listen(PORT, () => {
      console.log(`SERVER RUNNING on PORT ${PORT}`);
    });
  } catch (err) {
    console.error("DB CONNECTION ERROR:", err);
  }
};

start();
