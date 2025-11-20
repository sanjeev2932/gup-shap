// backend/src/controllers/socketManager.js
import { Server } from "socket.io";

export function connectToSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
    },
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  const rooms = {};

  io.on("connection", (socket) => {
    console.log("socket connected:", socket.id);

    // ------------------ JOIN REQUEST ------------------
    socket.on("join-request", ({ room, username }) => {
      username = username || socket.id;

      if (!rooms[room])
        rooms[room] = { hostId: null, members: [], pending: [] };

      const state = rooms[room];

      // FIRST USER = HOST
      if (!state.hostId) {
        state.hostId = socket.id;
        state.members.push({
          id: socket.id,
          username,
          mic: true,
          cam: true,
        });

        socket.join(room);
        socket.emit("joined", { members: state.members, isHost: true });
        io.to(room).emit("members", state.members);
        return;
      }

      // OTHERS → PENDING APPROVAL
      state.pending.push({ id: socket.id, username });

      io.to(state.hostId).emit("lobby-request", {
        id: socket.id,
        username,
      });

      socket.emit("lobby-wait", { hostId: state.hostId });
    });

    // ------------------ APPROVE JOIN ------------------
    socket.on("approve-join", ({ room, userId }) => {
      const state = rooms[room];
      if (!state || socket.id !== state.hostId) return;

      const idx = state.pending.findIndex((p) => p.id === userId);
      if (idx === -1) return;

      const approved = state.pending.splice(idx, 1)[0];

      state.members.push({
        id: approved.id,
        username: approved.username,
        mic: true,
        cam: true,
      });

      io.to(approved.id).emit("approved", {
        members: state.members,
        isHost: false,
      });

      io.to(room).emit("members", state.members);

      io.to(room).emit("user-joined", {
        id: approved.id,
        username: approved.username,
      });
    });

    // ------------------ MEMBER SNAPSHOT ------------------
    socket.on("get-members", ({ room }) => {
      const state = rooms[room] || { members: [] };
      socket.emit("members", state.members);
    });

    // ------------------ SIGNALING (RTC) ------------------
    socket.on("signal", ({ to, type, data }) => {
      io.to(to).emit("signal", {
        from: socket.id,
        type,
        data,
      });
    });

    // ------------------ MEDIA UPDATE ------------------
    socket.on("media-update", ({ room, mic, cam }) => {
      const state = rooms[room];
      if (!state) return;

      const m = state.members.find((x) => x.id === socket.id);
      if (m) {
        if (typeof mic === "boolean") m.mic = mic;
        if (typeof cam === "boolean") m.cam = cam;
      }

      io.to(room).emit("members", state.members);
    });

    // ------------------ SCREEN SHARE (ADDED) ------------------
    socket.on("screen-share", ({ room, from, sharing }) => {
      io.to(room).emit("screen-share", { from, sharing });
    });

    // ------------------ RAISE HAND ------------------
    socket.on("raise-hand", ({ room }) => {
      const state = rooms[room];
      if (!state) return;

      const username =
        state.members.find((m) => m.id === socket.id)?.username ||
        socket.id;

      io.to(room).emit("raise-hand", {
        from: socket.id,
        username,
      });
    });

    // ------------------ DISCONNECT ------------------
    socket.on("disconnect", () => {
      console.log("socket disconnected:", socket.id);

      for (const room in rooms) {
        const state = rooms[room];
        if (!state) continue;

        // Remove from members
        const memIdx = state.members.findIndex((m) => m.id === socket.id);
        if (memIdx !== -1) {
          const left = state.members.splice(memIdx, 1)[0];

          io.to(room).emit("user-left", { id: left.id });
          io.to(room).emit("members", state.members);

          // Host left → promote first member
          if (state.hostId === socket.id) {
            state.hostId = state.members.length
              ? state.members[0].id
              : null;

            if (state.hostId)
              io.to(state.hostId).emit("promoted-host");
          }
        }

        // Remove from pending
        const pendingIdx = state.pending.findIndex(
          (p) => p.id === socket.id
        );
        if (pendingIdx !== -1) state.pending.splice(pendingIdx, 1);
      }
    });
  });

  return io;
}
