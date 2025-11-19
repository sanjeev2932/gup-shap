// server.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Server } = require('socket.io');
const path = require('path');

const authRoutes = require('./routes/auth');

const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || '*';

const app = express();

app.use(cors({
  origin: (origin, cb) => cb(null, true),
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Mount auth routes at /api/auth
app.use('/api/auth', authRoutes);

// Health
app.get('/', (req, res) => res.send({ status: 'ok' }));

// Create HTTP server and attach socket.io
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL === '*' ? '*' : FRONTEND_URL,
    methods: ["GET", "POST"]
  }
});

// Signaling namespace (you can change namespace on frontend if desired)
io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  socket.on('join-room', (roomId, userName) => {
    socket.join(roomId);
    console.log(`${userName || socket.id} joined room ${roomId}`);
    // notify others
    socket.to(roomId).emit('user-joined', { id: socket.id, name: userName });
  });

  socket.on('signal', (payload) => {
    // payload: { to, data }
    const { to, data } = payload;
    if (to) {
      io.to(to).emit('signal', { from: socket.id, data });
    }
  });

  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    socket.to(roomId).emit('user-left', { id: socket.id });
  });

  socket.on('disconnect', () => {
    console.log('socket disconnected', socket.id);
    // optionally broadcast disconnect (you might want to maintain a map room->users)
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
