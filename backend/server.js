// server.js
const express = require("express");
const http = require("http");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Server } = require("socket.io");
const path = require("path");

const authRoutes = require("./src/routes/users.routes.js");

const PORT = process.env.PORT || 5000;

const app = express();

// Middlewares
app.use(cors({ origin: "*", credentials: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// API ROUTES
app.use("/api/auth", authRoutes);

// Health Check
app.get("/", (req, res) => res.send({ status: "ok" }));

// HTTP Server + Socket.io
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);

  socket.on("join-room", (roomId, username) => {
    socket.join(roomId);
    socket.to(roomId).emit("user-joined", { id: socket.id, username });
  });

  socket.on("signal", ({ to, data }) => {
    io.to(to).emit("signal", { from: socket.id, data });
  });

  socket.on("leave-room", (roomId) => {
    socket.leave(roomId);
    socket.to(roomId).emit("user-left", { id: socket.id });
  });

  socket.on("disconnect", () => {
    console.log("socket disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
