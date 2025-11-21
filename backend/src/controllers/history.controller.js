import History from "../models/history.model.js";

export const addHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { roomId } = req.body;

    await History.create({ userId, roomId });

    return res.json({ success: true });
  } catch (err) {
    console.log("History Add Error:", err);
    return res.status(500).json({ success: false });
  }
};

export const getHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    const history = await History.find({ userId }).sort({ createdAt: -1 });

    return res.json({ success: true, history });
  } catch (err) {
    return res.status(500).json({ success: false });
  }
};
