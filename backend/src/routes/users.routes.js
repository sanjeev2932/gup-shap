import express from "express";
import { registerUser, loginUser } from "../controllers/user.controller.js";

const router = express.Router();

// /api/v1/users/register
router.post("/register", registerUser);

// /api/v1/users/login
router.post("/login", loginUser);

export default router;
