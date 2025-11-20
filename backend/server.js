// server.js
const express = require("express");
const http = require("http");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Server } = require("socket.io");
const path = require("path");

// USE ONLY THIS ROUTE
const userRoutes = require("./src/routes/users.routes.js").default;

const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || "*";

const app = express();

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MOUNT CORRECT AUTH ROUTES
app.use("/api/users", userRoutes);

app.get("/", (req, res) => res.send({ status: "ok" }));

const server = http.createServer(app);

// SOCKET.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("socket connected", socket.id);
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
