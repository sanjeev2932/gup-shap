// backend/src/routes/history.routes.js
import express from "express";
import {
  addHistory,
  getHistory,
  deleteHistoryItem,
  bulkDeleteHistory,
} from "../controllers/history.controller.js";
import auth from "../middleware/auth.js";

const router = express.Router();

/**
 * @route POST /api/v1/history/add
 * @desc Save a meeting entry for the logged-in user
 * @access Private
 */
router.post("/add", auth, addHistory);

/**
 * @route GET /api/v1/history
 * @desc Fetch meeting history for logged-in user
 * @access Private
 */
router.get("/", auth, getHistory);

/**
 * @route DELETE /api/v1/history/:id
 * @desc Delete one history item
 * @access Private
 */
router.delete("/:id", auth, deleteHistoryItem);

/**
 * @route POST /api/v1/history/bulk-delete
 * @desc Delete many history items
 * @access Private
 */
router.post("/bulk-delete", auth, bulkDeleteHistory);

export default router;
