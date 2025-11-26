// gup-shap/backend/src/socket/socketManager.js

import { Server } from "socket.io";

const rooms = Object.create(null);
// Track screen sharing for each room
const screenShares = Object.create(null);

export default function attachSocket(server) {
  const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"], allowedHeaders: ["Authorization"] },
  });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    const ensureRoom = (room) => {
      if (!rooms[room]) rooms[room] = { members: [], hostId: null };
      return rooms[room];
    };

    const emitMembers = (room) => {
      const r = rooms[room];
      if (!r) return;
      io.to(room).emit("members", r.members);
    };

    socket.on("join-request", ({ room = "lobby", username = "Guest" } = {}) => {
      const r = ensureRoom(room);

      // If already a member
      if (r.members.find((m) => m.id === socket.id)) {
        socket.join(room);
        socket.emit("joined", { members: r.members, isHost: r.hostId === socket.id });
        // If screen sharing is ongoing, inform the new joiner
        if (screenShares[room]) {
          socket.emit("screen-share-started", { sharingId: screenShares[room] });
        }
        return;
      }

      const isFirst = r.members.length === 0;
      const member = { id: socket.id, username };

      // First user is host and joins immediately
      if (isFirst) {
        r.hostId = socket.id;
        member.pending = false;
        r.members.push(member);
        socket.join(room);
        socket.emit("joined", { members: r.members, isHost: true, approved: true });
        socket.to(room).emit("user-joined", { id: socket.id, username });
        emitMembers(room);
        return;
      }

      // All others marked as pending
      member.pending = true;
      r.members.push(member);
      socket.join(room);

      // Send request to host for approval
      io.to(r.hostId).emit("join-pending", { userId: socket.id, username, room });

      // Notify guest they're waiting for approval
      socket.emit("waiting-approval", { room });

      emitMembers(room);
    });

    socket.on("approve-join", ({ room = "lobby", userId } = {}) => {
      const r = rooms[room];
      if (!r || r.hostId !== socket.id) return; // only host can approve

      const idx = r.members.findIndex((m) => m.id === userId && m.pending);
      if (idx === -1) return;

      r.members[idx].pending = false;

      // Notify approved user
      io.to(userId).emit("approved", { members: r.members, approved: true });
      // If screen sharing, inform the newly approved user
      if (screenShares[room]) {
        io.to(userId).emit("screen-share-started", { sharingId: screenShares[room] });
      }
      emitMembers(room);
    });

    socket.on("reject-join", ({ room = "lobby", userId } = {}) => {
      const r = rooms[room];
      if (!r || r.hostId !== socket.id) return; // only host can reject

      const idx = r.members.findIndex((m) => m.id === userId && m.pending);
      if (idx !== -1) {
        r.members.splice(idx, 1);
        io.to(userId).emit("rejected", { room });
        emitMembers(room);
      }
    });

    socket.on("get-members", ({ room = "lobby" } = {}) => {
      const r = rooms[room];
      const members = r ? r.members : [];
      socket.emit("members", members);
    });

    socket.on("signal", ({ to, type, data } = {}) => {
      if (!to) return;
      io.to(to).emit("signal", { from: socket.id, type, data });
    });

    // --- SCREEN SHARE SYNC EVENTS ---
    socket.on("screen-share-started", ({ sharingId, room }) => {
      screenShares[room] = sharingId;
      io.to(room).emit("screen-share-started", { sharingId });
    });
    socket.on("screen-share-stopped", ({ room }) => {
      delete screenShares[room];
      io.to(room).emit("screen-share-stopped");
    });

    socket.on("disconnect", () => {
      for (const room of Object.keys(rooms)) {
        const r = rooms[room];
        const idx = r.members.findIndex((m) => m.id === socket.id);
        if (idx !== -1) {
          r.members.splice(idx, 1);
          if (r.hostId === socket.id) {
            r.hostId = (r.members[0] && r.members[0].id) || null;
          }
          io.in(room).emit("user-left", { id: socket.id });
          emitMembers(room);
        }
        // If leaving user was sharing, stop sharing for everyone
        if (screenShares[room] === socket.id) {
          delete screenShares[room];
          io.to(room).emit("screen-share-stopped");
        }
        if (r.members.length === 0) delete rooms[room];
      }
      console.log("Socket disconnected:", socket.id);
    });
  });

  return io;
}
