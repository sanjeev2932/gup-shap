import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import dotenv from "dotenv";

// load env
dotenv.config();

import userRoutes from "./src/routes/users.routes.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", userRoutes);

app.get("/", (req, res) => {
  res.send("Backend running");
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);
  
  socket.on("join-room", (room, name) => {
    socket.join(room);
    socket.to(room).emit("user-joined", { id: socket.id, name });
  });

  socket.on("signal", ({ to, data }) => {
    io.to(to).emit("signal", { from: socket.id, data });
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
