// frontend/src/pages/home.jsx
import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../index.css"; // ensures global styles applied

export default function HomeComponent() {
  let navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState("");

  const handleJoin = () => {
    if (!meetingCode || meetingCode.trim() === "") {
      // if empty, create random code and go
      const code = Math.random().toString(36).slice(2, 8);
      navigate(`/${code}`);
    } else {
      navigate(`/${meetingCode}`);
    }
  };

  return (
    <div className="page-center">
      <div className="home-grid">
        <div className="home-left">
          <h1>Providing Quality Video Calls</h1>
          <p>Enter a meeting code or create a new one to start a call.</p>

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
            <input
              className="input meeting-code-input"
              placeholder="Meeting Code"
              value={meetingCode}
              onChange={(e) => setMeetingCode(e.target.value)}
            />
            <button className="btn primary" onClick={handleJoin}>
              JOIN
            </button>
          </div>
        </div>

        <div className="home-right">
          <img src="/mobile.png" alt="mobile" className="illustration" />
        </div>
      </div>
    </div>
  );
}
