// backend/src/controllers/history.controller.js
import History from "../models/history.model.js";

/**
 * Add a meeting history entry for the authenticated user
 */
export const addHistory = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { roomId } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!roomId || typeof roomId !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "roomId is required" });
    }

    await History.create({ userId, roomId });

    return res.json({ success: true, message: "History saved" });
  } catch (err) {
    console.error("History Add Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while saving history",
    });
  }
};

/**
 * Get meeting history for authenticated user
 */
export const getHistory = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const history = await History.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      history: history || [],
    });
  } catch (err) {
    console.error("History Fetch Error:", err);
    return res.status(500).json({
      success: false,
      history: [],
      message: "Server error while fetching history",
    });
  }
};
