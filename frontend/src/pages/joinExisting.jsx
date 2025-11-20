// frontend/src/pages/JoinExisting.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/joinExisting.css";

export default function JoinExisting() {
  const [room, setRoom] = useState("");
  const navigate = useNavigate();

  const joinNow = () => {
    const id = (room || "").trim();
    if (!id) return alert("Please enter a room ID");
    navigate(`/${encodeURIComponent(id)}`);
  };

  const generate = () => {
    const rnd = Math.random().toString(36).slice(2, 8);
    setRoom(rnd);
  };

  return (
    <div className="joinWrapper">

      {/* Floating shapes */}
      <div className="joinShape shapeA"></div>
      <div className="joinShape shapeB"></div>
      <div className="joinShape shapeC"></div>

      <div className="joinCard">
        <h2>Join a Meeting</h2>
        <p className="joinDesc">
          Enter a meeting code or generate a new one.
        </p>

        <input
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder="Enter meeting code"
          className="joinInput"
        />

        <div className="joinButtons">
          <button className="bubbleBtn primary" onClick={joinNow}>Join</button>
          <button className="bubbleBtn outline" onClick={generate}>Generate</button>
        </div>

        <p className="tipText">
          Share this code with the person you want to call.
        </p>
      </div>
    </div>
  );
}
