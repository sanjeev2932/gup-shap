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

  // in-memory room state for lobby example: { roomId: { hostId, members: [{id, username}], pending: [{id, username}] } }
  const roomsState = {};

  io.on("connection", (socket) => {
    console.log("socket connected", socket.id);

    socket.on("join-request", ({ room, username }) => {
      username = username || socket.id;
      const roomState = roomsState[room] || { hostId: null, members: [], pending: [] };
      // if no members yet, make this user host and allow join
      if (!roomState.hostId) {
        roomState.hostId = socket.id;
        roomState.members.push({ id: socket.id, username });
        roomsState[room] = roomState;
        socket.join(room);
        socket.emit("joined", { members: roomState.members, isHost: true });
        io.to(room).emit("members", roomState.members);
        return;
      }

      // if lobby enabled (we'll enable by default), push to pending
      roomState.pending.push({ id: socket.id, username });
      roomsState[room] = roomState;
      // notify host to approve
      io.to(roomState.hostId).emit("lobby-request", { id: socket.id, username });
      socket.emit("lobby-wait", { hostId: roomState.hostId });
    });

    socket.on("approve-join", ({ room, userId }) => {
      const roomState = roomsState[room];
      if (!roomState) return;
      if (socket.id !== roomState.hostId) return; // only host can approve

      const idx = roomState.pending.findIndex(p => p.id === userId);
      if (idx === -1) return;
      const approved = roomState.pending.splice(idx, 1)[0];
      roomState.members.push(approved);
      roomsState[room] = roomState;

      // move the user into room
      io.to(approved.id).emit("approved", { members: roomState.members, isHost: false });
      io.to(room).emit("members", roomState.members);
    });

    socket.on("get-members", ({ room }) => {
      const roomState = roomsState[room] || { members: [] };
      socket.emit("members", roomState.members);
    });

    // generic signaling proxy (offer/answer/candidate)
    socket.on("signal", ({ to, type, data }) => {
      if (!to) return;
      io.to(to).emit("signal", { from: socket.id, type, data });
    });

    socket.on("raise-hand", ({ room, raised }) => {
      // broadcast raise-hand to host and room
      const roomState = roomsState[room];
      if (!roomState) return;
      io.to(roomState.hostId).emit("raise-hand", { from: socket.id, username: /* find name */ (roomState.members.find(m => m.id===socket.id) || {}).username || socket.id, raised });
      io.to(room).emit("raise-hand", { from: socket.id, username: (roomState.members.find(m => m.id===socket.id) || {}).username || socket.id, raised });
    });

    socket.on("disconnect", () => {
      // remove from roomsState
      for (const room in roomsState) {
        const st = roomsState[room];
        const memIdx = st.members.findIndex(m => m.id === socket.id);
        if (memIdx !== -1) {
          st.members.splice(memIdx, 1);
          // if host left, promote first member to host
          if (st.hostId === socket.id) {
            st.hostId = st.members.length ? st.members[0].id : null;
            if (st.hostId) io.to(st.hostId).emit("promoted-host");
          }
          io.to(room).emit("members", st.members);
        }
        const pendingIdx = st.pending.findIndex(p => p.id === socket.id);
        if (pendingIdx !== -1) st.pending.splice(pendingIdx, 1);
        roomsState[room] = st;
      }
    });
  });

  return io;
}
