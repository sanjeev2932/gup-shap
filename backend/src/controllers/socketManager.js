socket.on("join-request", ({ room, username }) => {
  username = username || socket.id;
  if (!rooms[room]) rooms[room] = { hostId: null, members: [], pending: [] };
  const state = rooms[room];

  // Empty room -> first user becomes host and joins immediately
  if (!state.hostId) {
    state.hostId = socket.id;
    state.members.push({ id: socket.id, username, mic: true, cam: true });
    rooms[room] = state;
    socket.join(room);
    socket.emit("joined", { members: state.members, isHost: true });
    io.to(room).emit("members", state.members);
    return;
  }

  // Otherwise push to pending list (lobby)
  state.pending.push({ id: socket.id, username });
  rooms[room] = state;
  // notify host to approve
  io.to(state.hostId).emit("lobby-request", { id: socket.id, username });
  socket.emit("lobby-wait", { hostId: state.hostId });
});

socket.on("approve-join", ({ room, userId }) => {
  const state = rooms[room];
  if (!state) return;
  if (socket.id !== state.hostId) return; // only host can approve

  const idx = state.pending.findIndex((p) => p.id === userId);
  if (idx === -1) return;
  const approved = state.pending.splice(idx, 1)[0];
  state.members.push({ id: approved.id, username: approved.username, mic: true, cam: true });
  rooms[room] = state;

  // notify the approved user and update everyone
  io.to(approved.id).emit("approved", { members: state.members, isHost: false });
  io.to(room).emit("members", state.members);
  io.to(room).emit("user-joined", { id: approved.id, username: approved.username });
});

socket.on("get-members", ({ room }) => {
  const state = rooms[room] || { members: [] };
  socket.emit("members", state.members);
});

// generic signaling proxy (offer/answer/candidate)
socket.on("signal", ({ to, type, data }) => {
  if (!to) return;
  io.to(to).emit("signal", { from: socket.id, type, data });
});

// media state update (mic/cam toggles) -> update and broadcast members
socket.on("media-update", ({ room, mic, cam }) => {
  const state = rooms[room];
  if (!state) return;
  const m = state.members.find((x) => x.id === socket.id);
  if (m) {
    if (typeof mic === "boolean") m.mic = mic;
    if (typeof cam === "boolean") m.cam = cam;
  }
  rooms[room] = state;
  // broadcast updated members (so UI can show mic/cam badges)
  io.to(room).emit("members", state.members);
});

// raise-hand broadcast (to host and to room)
socket.on("raise-hand", ({ room, raised }) => {
  const state = rooms[room];
  if (!state) return;
  const username = (state.members.find((m) => m.id === socket.id) || {}).username || socket.id;
  io.to(state.hostId).emit("raise-hand", { from: socket.id, username, raised });
  io.to(room).emit("raise-hand", { from: socket.id, username, raised });
});

// handle disconnect: remove from members/pending, promote host if needed
socket.on("disconnect", () => {
  for (const room in rooms) {
    const st = rooms[room];
    if (!st) continue;
    // remove from members
    const memIdx = st.members.findIndex((m) => m.id === socket.id);
    if (memIdx !== -1) {
      const leftUser = st.members.splice(memIdx, 1)[0];
      // broadcast user-left and updated members
      io.to(room).emit("user-left", { id: leftUser.id });
      io.to(room).emit("members", st.members);
      // promote a new host if needed
      if (st.hostId === socket.id) {
        st.hostId = st.members.length ? st.members[0].id : null;
        if (st.hostId) io.to(st.hostId).emit("promoted-host");
      }
    }
    // remove from pending
    const pendingIdx = st.pending.findIndex((p) => p.id === socket.id);
    if (pendingIdx !== -1) st.pending.splice(pendingIdx, 1);
    rooms[room] = st;
  }
  console.log("socket disconnected", socket.id);
});
