import express from "express";
import { addHistory, getHistory } from "../controllers/history.controller.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// POST /api/v1/history/add
router.post("/add", auth, addHistory);

// GET /api/v1/history
router.get("/", auth, getHistory);

export default router;
