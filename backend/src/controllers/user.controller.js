// backend/src/controllers/user.controller.js
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_THIS_SECRET";

export const registerUser = async (req, res) => {
  try {
    const { name, username, password } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({ success: false, message: "All fields required" });
    }

    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ success: false, message: "Username already taken" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, username, password: hashed });

    // hide password from response
    const safeUser = { id: user._id, name: user.name, username: user.username };

    return res.json({ success: true, message: "Registered", user: safeUser });
  } catch (err) {
    console.error("registerUser err:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: "Username and password required" });

    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ success: false, message: "Wrong credentials" });

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
    const safeUser = { id: user._id, name: user.name, username: user.username };

    return res.json({ success: true, message: "Logged in", token, user: safeUser });
  } catch (err) {
    console.error("loginUser err:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
