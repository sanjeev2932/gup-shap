import express from "express";
import http from "http";
import cors from "cors";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import { Server } from "socket.io";
import usersRoutes from "./src/routes/users.routes.js";

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || "*";

// ----------------- MONGO CONNECT -----------------
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("MongoDB connected"))
.catch(err => console.log("Mongo error:", err));

// ----------------- MIDDLEWARE -----------------
app.use(cors({
  origin: FRONTEND_URL === "*" ? "*" : FRONTEND_URL,
  credentials: true,
}));

app.use(bodyParser.json());

// ----------------- API ROUTES -----------------
app.use("/api/users", usersRoutes);

// HEALTH CHECK
app.get("/", (req, res) => res.json({ status: "ok" }));

// ----------------- SOCKET.IO -----------------
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL === "*" ? "*" : FRONTEND_URL,
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join-room", (roomId, username) => {
    socket.join(roomId);
    socket.to(roomId).emit("user-joined", { id: socket.id, username });
  });

  socket.on("signal", ({ to, data }) => {
    io.to(to).emit("signal", { from: socket.id, data });
  });

  socket.on("user-left", (roomId) => {
    socket.to(roomId).emit("user-left", { id: socket.id });
    socket.leave(roomId);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

server.listen(PORT, () => console.log(`Server running on ${PORT}`));
