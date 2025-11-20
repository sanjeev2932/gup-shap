// frontend/src/pages/JoinExisting.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/landing.css"; 
import "../styles/joinExisting.css";

export default function JoinExisting() {
  const [room, setRoom] = useState("");
  const navigate = useNavigate();

  const joinNow = () => {
    const id = room.trim();
    if (!id) return alert("Enter a valid meeting code.");

    // ✅ correct meeting route
    navigate(`/meet/${id}`);
  };

  const generate = () => {
    const rnd = Math.random().toString(36).substring(2, 9);
    setRoom(rnd);
  };

  return (
    <div className="joinExistingContainer">

      {/* Header */}
      <header className="joinHeader">
        <h2 className="logoText">Gup-Shap</h2>
        <button className="backBtn" onClick={() => navigate("/")}>
          ← Back
        </button>
      </header>

      {/* Card */}
      <div className="joinCard">
        <h1 className="joinTitle">Join a Meeting</h1>
        <p className="joinDesc">Enter a meeting code or generate a new one.</p>

        <input
          className="meetingInput"
          placeholder="Enter meeting code"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
        />

        <div className="actionsRow">
          <button className="btn-primary" onClick={joinNow}>Join</button>
          <button className="btn-secondary" onClick={generate}>Generate</button>
        </div>

        {room && (
          <p className="generatedCode">
            Meeting Code: <span>{room}</span>
          </p>
        )}

        <p className="tipText">Share this code with the person you want to call.</p>
      </div>

    </div>
  );
}
