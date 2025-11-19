// backend/src/controllers/socketManager.js
import { Server } from "socket.io";

export function connectToSocket(server) {
  const io = new Server(server, {
    cors: { origin: "*" }
  });

  // room structure
  const rooms = {};
  io.on("connection", (socket) => {
    console.log("socket connected", socket.id);

    socket.on("join-request", ({ room, username }) => {
      username = username || socket.id;
      if (!rooms[room]) rooms[room] = { hostId: null, members: [], pending: [] };
      const state = rooms[room];

      // if no host set, make this socket host and join immediately
      if (!state.hostId) {
        state.hostId = socket.id;
        state.members.push({ id: socket.id, username, mic: true, cam: true });
        socket.join(room);
        socket.emit("joined", { members: state.members, isHost: true });
        io.to(room).emit("members", state.members);
        return;
      }

      // otherwise push to pending lobby and notify host
      state.pending.push({ id: socket.id, username });
      rooms[room] = state;
      io.to(state.hostId).emit("lobby-request", { id: socket.id, username });
      socket.emit("lobby-wait", { hostId: state.hostId });
    });

    socket.on("approve-join", ({ room, userId }) => {
      const state = rooms[room];
      if (!state) return;
      if (socket.id !== state.hostId) return;

      const idx = state.pending.findIndex(p => p.id === userId);
      if (idx === -1) return;
      const approved = state.pending.splice(idx, 1)[0];

      // add to members and join socket to room
      state.members.push({ id: approved.id, username: approved.username, mic: true, cam: true });
      rooms[room] = state;

      io.to(approved.id).emit("approved", { members: state.members, isHost: false });
      io.to(room).emit("members", state.members);
      io.to(room).emit("user-joined", { id: approved.id, username: approved.username });
    });

    socket.on("get-members", ({ room }) => {
      const state = rooms[room] || { members: [] };
      socket.emit("members", state.members);
    });

    socket.on("signal", ({ to, type, data }) => {
      if (!to) return;
      io.to(to).emit("signal", { from: socket.id, type, data });
    });

    socket.on("media-update", ({ room, mic, cam }) => {
      const state = rooms[room];
      if (!state) return;
      const m = state.members.find(x => x.id === socket.id);
      if (m) {
        if (typeof mic === "boolean") m.mic = mic;
        if (typeof cam === "boolean") m.cam = cam;
      }
      io.to(room).emit("members", state.members);
    });

    socket.on("raise-hand", ({ room, raised }) => {
      const state = rooms[room];
      if (!state) return;
      const username = (state.members.find(m => m.id === socket.id) || {}).username || socket.id;
      io.to(room).emit("raise-hand", { from: socket.id, username, raised });
    });

    socket.on("disconnect", () => {
      for (const room in rooms) {
        const st = rooms[room];
        if (!st) continue;

        const memIdx = st.members.findIndex(m => m.id === socket.id);
        if (memIdx !== -1) {
          const left = st.members.splice(memIdx, 1)[0];
          io.to(room).emit("user-left", { id: left.id });
          io.to(room).emit("members", st.members);
          if (st.hostId === socket.id) {
            st.hostId = st.members.length ? st.members[0].id : null;
            if (st.hostId) io.to(st.hostId).emit("promoted-host");
          }
        }

        const pendingIdx = st.pending.findIndex(p => p.id === socket.id);
        if (pendingIdx !== -1) st.pending.splice(pendingIdx, 1);
      }
      console.log("socket disconnected", socket.id);
    });
  });

  return io;
}
