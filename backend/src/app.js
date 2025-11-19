// backend/src/app.js
import express from 'express';
import { createServer } from 'node:http';
import mongoose from 'mongoose';
import cors from 'cors';
import userRoutes from './routes/users.routes.js';
import { connectToSocket } from './controllers/socketManager.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/v1/users', userRoutes);

const server = createServer(app);
const io = connectToSocket(server);

const PORT = process.env.PORT || 8000;

async function start() {
  try {
    if (process.env.MONGO_URI) {
      await mongoose.connect(process.env.MONGO_URI);
      console.log("Connected to MongoDB");
    } else {
      console.log("MONGO_URI not set - continuing without DB");
    }
    server.listen(PORT, () => console.log('Server started on', PORT));
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

start();
