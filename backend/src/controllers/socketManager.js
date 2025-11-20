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

  // room = { hostId, members[], pending[] }
  const rooms = {};

  // ------------------ BUILD COMBINED MEMBER SNAPSHOT ------------------
  function buildMemberSnapshot(state) {
    const combined = [];

    // normal approved members
    state.members.forEach((m) => {
      combined.push({
        id: m.id,
        username: m.username,
        mic: m.mic,
        cam: m.cam,
        sharing: m.sharing || false,
        pending: false,
      });
    });

    // pending users
    state.pending.forEach((p) => {
      combined.push({
        id: p.id,
        username: p.username,
        pending: true,
        mic: false,
        cam: false,
        sharing: false,
      });
    });

    return combined;
  }

  function emitMembers(room) {
    const state = rooms[room];
    if (!state) return;

    io.to(room).emit("members", {
      members: buildMemberSnapshot(state),
      hostId: state.hostId,
    });
  }

  // --------------------------------------------------------------
  // CONNECTION
  // --------------------------------------------------------------
  io.on("connection", (socket) => {
    console.log("socket connected:", socket.id);

    // ------------------ JOIN REQUEST ------------------
    socket.on("join-request", ({ room, username }) => {
      username = username || socket.id;

      if (!rooms[room]) {
        rooms[room] = { hostId: null, members: [], pending: [] };
      }

      const state = rooms[room];

      // FIRST USER → HOST
      if (!state.hostId) {
        state.hostId = socket.id;
        state.members.push({
          id: socket.id,
          username,
          mic: true,
          cam: true,
          sharing: false,
        });

        socket.join(room);
        socket.emit("joined", {
          members: buildMemberSnapshot(state),
          isHost: true,
        });

        emitMembers(room);
        return;
      }

      // Others → pending approval
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
        sharing: false,
      });

      io.to(approved.id).emit("approved", {
        members: buildMemberSnapshot(state),
        isHost: false,
      });

      io.to(room).emit("user-joined", {
        id: approved.id,
        username: approved.username,
      });

      emitMembers(room);
    });

    // ------------------ GET MEMBERS ------------------
    socket.on("get-members", ({ room }) => {
      const state = rooms[room];
      if (!state) return;

      socket.emit("members", {
        members: buildMemberSnapshot(state),
        hostId: state.hostId,
      });
    });

    // ------------------ SIGNAL (RTC) ------------------
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

      emitMembers(room);
    });

    // ------------------ SCREEN SHARE ------------------
    socket.on("screen-share", ({ room, from, sharing }) => {
      const state = rooms[room];
      if (!state) return;

      const m = state.members.find((x) => x.id === from);
      if (m) m.sharing = sharing;

      io.to(room).emit("screen-share", { from, sharing });
      emitMembers(room);
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
          state.members.splice(memIdx, 1);

          io.to(room).emit("user-left", { id: socket.id });

          // Host left → promote first member
          if (state.hostId === socket.id) {
            state.hostId = state.members.length ? state.members[0].id : null;
            if (state.hostId) io.to(state.hostId).emit("promoted-host");
          }

          emitMembers(room);
        }

        // Remove from pending
        const pendIdx = state.pending.findIndex((p) => p.id === socket.id);
        if (pendIdx !== -1) state.pending.splice(pendIdx, 1);
      }
    });
  });

  return io;
}
