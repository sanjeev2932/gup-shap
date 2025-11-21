// backend/src/socketManager.js
import { Server } from "socket.io";

/**
 * Simple in-memory room state:
 * rooms = {
 *   roomId: {
 *     members: [{ id, username, pending?, sharing? }],
 *     hostId: socketId (first joined or approved user)
 *   }
 * }
 *
 * This file keeps logic intentionally compact:
 * - join-request -> places user in room as pending if room requires approval (simple: first user becomes host)
 * - approve-join -> host approves pending users
 * - get-members -> emit current members
 * - signal -> forward sdp/candidates to target
 * - screen-share, raise-hand -> broadcast small event
 * - disconnect -> remove user and notify
 */

const rooms = Object.create(null);

export default function attachSocket(server) {
  const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"], allowedHeaders: ["Authorization"] },
    // path: "/socket.io", // default
  });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    // helper: ensure room exists
    const ensureRoom = (room) => {
      if (!rooms[room]) rooms[room] = { members: [], hostId: null };
      return rooms[room];
    };

    // helper: list public members (no password)
    const emitMembers = (room) => {
      const r = rooms[room];
      if (!r) return;
      io.to(room).emit("members", r.members);
    };

    socket.on("join-request", ({ room = "lobby", username = "Guest" } = {}) => {
      const r = ensureRoom(room);

      // if socket already joined, skip
      if (r.members.find((m) => m.id === socket.id)) {
        socket.join(room);
        socket.emit("joined", { members: r.members, isHost: r.hostId === socket.id });
        return;
      }

      // first user becomes host automatically (no approval flow)
      const isFirst = r.members.length === 0;
      const member = { id: socket.id, username };

      if (isFirst) {
        r.hostId = socket.id;
        member.pending = false;
        r.members.push(member);
        socket.join(room);
        // notify this socket it joined
        socket.emit("joined", { members: r.members, isHost: true });
        // broadcast to others
        socket.to(room).emit("user-joined", { id: socket.id, username });
        emitMembers(room);
        return;
      }

      // For simplicity: add as member (no approval required). If you want approval flow, set pending true.
      member.pending = false;
      r.members.push(member);
      socket.join(room);

      // notify everybody in room
      socket.emit("joined", { members: r.members, isHost: r.hostId === socket.id });
      socket.to(room).emit("user-joined", { id: socket.id, username });
      emitMembers(room);
    });

    socket.on("get-members", ({ room = "lobby" } = {}) => {
      const r = rooms[room];
      const members = r ? r.members : [];
      socket.emit("members", members);
    });

    socket.on("approve-join", ({ room = "lobby", userId } = {}) => {
      // minimal: mark pending false and notify user (if present)
      const r = rooms[room];
      if (!r) return;
      // only host can approve (basic check)
      if (r.hostId !== socket.id) return;

      const idx = r.members.findIndex((m) => m.id === userId);
      if (idx === -1) return;

      r.members[idx].pending = false;
      io.to(userId).emit("approved", { members: r.members });
      emitMembers(room);
    });

    socket.on("signal", ({ to, type, data } = {}) => {
      if (!to) return;
      // forward to target socket id
      io.to(to).emit("signal", { from: socket.id, type, data });
    });

    socket.on("screen-share", ({ room = "lobby", from, sharing } = {}) => {
      const r = rooms[room];
      if (!r) return;
      // update member state
      r.members = r.members.map((m) => (m.id === from ? { ...m, sharing } : m));
      io.in(room).emit("screen-share", { from, sharing });
      emitMembers(room);
    });

    socket.on("raise-hand", ({ room = "lobby", raised, username } = {}) => {
      io.in(room).emit("raise-hand", { from: socket.id, username });
    });

    socket.on("media-update", ({ room = "lobby", mic, cam } = {}) => {
      socket.to(room).emit("media-update", { id: socket.id, mic, cam });
    });

    socket.on("get-members-for-host", ({ room = "lobby" } = {}) => {
      const r = rooms[room];
      if (!r) return;
      io.to(socket.id).emit("members", r.members);
    });

    socket.on("disconnect", () => {
      // remove from all rooms
      for (const room of Object.keys(rooms)) {
        const r = rooms[room];
        const idx = r.members.findIndex((m) => m.id === socket.id);
        if (idx !== -1) {
          r.members.splice(idx, 1);
          // if removed host, promote first member to host
          if (r.hostId === socket.id) {
            r.hostId = (r.members[0] && r.members[0].id) || null;
          }
          // notify room
          io.in(room).emit("user-left", { id: socket.id });
          emitMembers(room);
        }
        // cleanup empty rooms
        if (r.members.length === 0) delete rooms[room];
      }
      console.log("Socket disconnected:", socket.id);
    });
  });

  return io;
}
