const express = require("express");
const http = require("http");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const { Server } = require("socket.io");

const userRoutes = require("./src/routes/users.routes.js");

const PORT = process.env.PORT || 5000;

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// API routes
app.use("/api/auth", userRoutes);

// Health check
app.get("/", (req, res) => res.json({ status: "Backend OK" }));

// WebSocket server
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join-room", (roomId, username) => {
    socket.join(roomId);
    socket.to(roomId).emit("user-joined", { id: socket.id, name: username });
  });

  socket.on("signal", ({ to, data }) => {
    io.to(to).emit("signal", { from: socket.id, data });
  });

  socket.on("leave-room", (roomId) => {
    socket.to(roomId).emit("user-left", { id: socket.id });
    socket.leave(roomId);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
