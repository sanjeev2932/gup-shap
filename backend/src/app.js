import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import userRoutes from "./routes/users.routes.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// MIDDLEWARE
app.use(cors());
app.use(express.json());

// CONNECT MONGODB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// ROUTES
app.use("/api/users", userRoutes);

// ROOT TEST
app.get("/", (req, res) => {
  res.json({ message: "Backend running 🚀" });
});

export default app;
