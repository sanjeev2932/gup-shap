import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import app from "./src/app.js";

dotenv.config();

const server = http.createServer(app);

// SOCKET.IO
const io = new Server(server, {
  cors: { origin: "*" }
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Socket left:", socket.id);
  });
});

// START SERVER
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
