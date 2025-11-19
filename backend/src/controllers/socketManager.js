// backend/src/controllers/socketManager.js
import { Server } from "socket.io";

/*
  Export a function to attach socket.io to http server:
  const io = connectToSocket(server);
*/
export function connectToSocket(server) {
  const io = new Server(server, {
    cors: { origin: "*" }
  });

  // in-memory room state:
  // { roomId: { hostId, members: [{id,username,mic,cam}], pending: [{id,username}] } }
  const rooms = {};

  io.on("connection", (socket) => {
    console.log("socket connected", socket.id);

    socket.on("join-request", ({ room, username }) => {
      username = username || socket.id;
      if (!room) room = "lobby";

      if (!rooms[room]) {
        rooms[room] = { hostId: null, members: [], pending: [] };
      }

      const state = rooms[room];

      // first user becomes host
      if (!state.hostId) {
        state.hostId = socket.id;
        state.members.push({ id: socket.id, username, mic: true, cam: true });
        socket.join(room);
        socket.emit("joined", { members: state.members, isHost: true });
        io.to(room).emit("members", state.members);
        return;
      }

      // others go to pending (lobby)
      state.pending.push({ id: socket.id, username });
      io.to(state.hostId).emit("lobby-request", { id: socket.id, username });
      socket.emit("lobby-wait", { hostId: state.hostId });
    });

    socket.on("approve-join", ({ room, userId }) => {
      const state = rooms[room];
      if (!state) return;
      if (socket.id !== state.hostId) return;

      const idx = state.pending.findIndex((p) => p.id === userId);
      if (idx === -1) return;

      const approved = state.pending.splice(idx, 1)[0];
      state.members.push({ id: approved.id, username: approved.username, mic: true, cam: true });

      io.to(approved.id).emit("approved", { members: state.members, isHost: false });
      io.to(room).emit("members", state.members);
      io.to(room).emit("user-joined", { id: approved.id, username: approved.username });
    });

    socket.on("get-members", ({ room }) => {
      const state = rooms[room] || { members: [] };
      socket.emit("members", state.members);
    });

    // signaling proxy
    socket.on("signal", ({ to, type, data }) => {
      if (!to) return;
      io.to(to).emit("signal", { from: socket.id, type, data });
    });

    socket.on("media-update", ({ room, mic, cam }) => {
      const state = rooms[room];
      if (!state) return;
      const user = state.members.find((m) => m.id === socket.id);
      if (user) {
        if (typeof mic === "boolean") user.mic = mic;
        if (typeof cam === "boolean") user.cam = cam;
      }
      io.to(room).emit("members", state.members);
    });

    socket.on("raise-hand", ({ room, raised }) => {
      const state = rooms[room];
      if (!state) return;
      const username = (state.members.find((m) => m.id === socket.id) || {}).username || socket.id;
      io.to(room).emit("raise-hand", { from: socket.id, username, raised });
    });

    socket.on("disconnect", () => {
      for (const room in rooms) {
        const st = rooms[room];
        if (!st) continue;

        const memberIndex = st.members.findIndex((m) => m.id === socket.id);
        if (memberIndex !== -1) {
          const leftUser = st.members.splice(memberIndex, 1)[0];
          io.to(room).emit("user-left", { id: leftUser.id });
          io.to(room).emit("members", st.members);

          if (st.hostId === socket.id) {
            st.hostId = st.members.length ? st.members[0].id : null;
            if (st.hostId) io.to(st.hostId).emit("promoted-host");
          }
        }

        const pendingIndex = st.pending.findIndex((p) => p.id === socket.id);
        if (pendingIndex !== -1) st.pending.splice(pendingIndex, 1);
      }

      console.log("socket disconnected", socket.id);
    });
  });

  return io;
}
