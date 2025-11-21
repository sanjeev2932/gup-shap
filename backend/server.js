// backend/server.js
import http from "http";
import dotenv from "dotenv";
import app from "./src/app.js";
import attachSocket from "./src/socket/socketManager.js";   // <-- FIXED PATH

dotenv.config();

const server = http.createServer(app);

// attach sockets
attachSocket(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
