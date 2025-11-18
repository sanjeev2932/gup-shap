// backend/src/controllers/socketManager.js
import { Server } from "socket.io";

let connections = {};
let messages = {};
let timeOnline = {};

export const connectToSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      allowedHeaders: ["*"],
      credentials: true
    }
  });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("join-call", (path) => {
      const room = path.trim();
      if (!connections[room]) connections[room] = [];
      if (!connections[room].includes(socket.id)) connections[room].push(socket.id);

      timeOnline[socket.id] = new Date();

      // Join socket.io room for easier broadcasting (optional but useful)
      socket.join(room);

      // Notify all users in room (including the joining user)
      // We emit user-joined to each member with (joiningSocketId, connections[room])
      for (let i = 0; i < connections[room].length; i++) {
        io.to(connections[room][i]).emit("user-joined", socket.id, connections[room]);
      }

      // Send past messages (if any) to the new user
      if (messages[room]) {
        for (let i = 0; i < messages[room].length; i++) {
          const msg = messages[room][i];
          io.to(socket.id).emit("chat-message", msg.data, msg.sender, msg["socket-id-sender"]);
        }
      }
    });

    socket.on("signal", (toId, message) => {
      io.to(toId).emit("signal", socket.id, message);
    });

    socket.on("chat-message", (data, sender) => {
      // find matching room
      const [matchingRoom, found] = Object.entries(connections).reduce(([room, isFound], [roomKey, roomValue]) => {
        if (!isFound && roomValue.includes(socket.id)) return [roomKey, true];
        return [room, isFound];
      }, ['', false]);

      if (found) {
        if (!messages[matchingRoom]) messages[matchingRoom] = [];
        messages[matchingRoom].push({ sender, data, "socket-id-sender": socket.id });
        // broadcast
        connections[matchingRoom].forEach((elem) => {
          io.to(elem).emit("chat-message", data, sender, socket.id);
        });
      }
    });

    // raise-hand broadcast
    socket.on("raise-hand", (payload) => {
      // find room of the socket and broadcast raised-hand to others
      for (const [room, arr] of Object.entries(connections)) {
        if (arr.includes(socket.id)) {
          // broadcast to room
          arr.forEach(id => {
            io.to(id).emit("raised-hand", { username: payload.username, socketId: socket.id });
          });
        }
      }
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);

      for (const [room, arr] of Object.entries(JSON.parse(JSON.stringify(Object.entries(connections)))) ) {
        const key = room;
        const v = arr;
        for (let a = 0; a < v.length; ++a) {
          if (v[a] === socket.id) {
            // notify others
            for (let j = 0; j < connections[key].length; ++j) {
              io.to(connections[key][j]).emit('user-left', socket.id);
            }
            // remove from list
            const index = connections[key].indexOf(socket.id);
            if (index !== -1) connections[key].splice(index, 1);
            if (connections[key].length === 0) delete connections[key];
          }
        }
      }

      // cleanup timeOnline
      if (timeOnline[socket.id]) delete timeOnline[socket.id];
    });
  });

  return io;
}
