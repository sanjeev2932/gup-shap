// frontend/src/pages/JoinExisting.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

/*
  Simple join UI. When user enters a room id and clicks Join,
  it navigates to /:roomId (VideoMeet route).
*/

export default function JoinExisting() {
  const [room, setRoom] = useState("");
  const navigate = useNavigate();

  const joinNow = () => {
    const id = (room || "").trim();
    if (!id) return alert("Please enter a room ID");
    // navigate using react-router (SPA-safe)
    navigate(`/${encodeURIComponent(id)}`);
  };

  const generate = () => {
    // quick random room generator
    const rnd = Math.random().toString(36).slice(2, 8);
    setRoom(rnd);
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(180deg,#061523 0%, #061020 100%)",
      padding: 20
    }}>
      <div style={{
        width: 380,
        background: "#0f1b28",
        padding: 26,
        borderRadius: 12,
        boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
        color: "#e6eef6"
      }}>
        <h2 style={{ margin: 0, marginBottom: 14 }}>Join a room</h2>
        <p style={{ fontSize: 13, color: "#a9b6c6", marginBottom: 18 }}>
          Enter the room ID someone shared, or generate a new one to start.
        </p>

        <input
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder="room id (e.g. ab12cd)"
          style={{
            width: "100%", padding: 12, borderRadius: 8, border: "1px solid #23333f",
            background: "#08161f", color: "#fff", marginBottom: 12, outline: "none"
          }}
        />

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={joinNow} style={{
            flex: 1, padding: 11, borderRadius: 8, border: "none", background: "#1b7bff", color: "#fff",
            cursor: "pointer", fontWeight: 600
          }}>
            Join
          </button>

          <button onClick={generate} style={{
            padding: 11, borderRadius: 8, border: "1px solid #2a3b46", background: "transparent", color: "#ddd",
            cursor: "pointer"
          }}>
            Generate
          </button>
        </div>

        <p style={{ fontSize: 12, color: "#8196a6", marginTop: 14 }}>
          Tip: share the exact room id with the person you want to call.
        </p>
      </div>
    </div>
  );
}
