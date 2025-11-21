// backend/server.js
import http from "http";
import dotenv from "dotenv";
import app from "./src/app.js";
import attachSocket from "./src/socketManager.js";

dotenv.config();

const server = http.createServer(app);

// attach socket handlers (keeps socket code separate and testable)
const io = attachSocket(server);

// start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
