import mongoose from "mongoose";

const HistorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    roomId: { type: String, required: true }
  },
  { timestamps: true }
);

export default mongoose.model("History", HistorySchema);
