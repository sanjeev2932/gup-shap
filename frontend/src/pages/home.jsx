// frontend/src/pages/home.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/landing.css"; // for consistent UI

export default function Home() {
  const navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState("");

  useEffect(() => {
    document.body.classList.remove("dark-meeting");
    document.body.classList.add("light-mode");
  }, []);

  const handleJoin = () => {
    if (!meetingCode.trim()) {
      return alert("Enter a valid meeting code.");
    }
    navigate(`/${meetingCode}`);
  };

  const createNew = () => {
    const rnd = Math.random().toString(36).substring(2, 9);
    navigate(`/${rnd}`);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  return (
    <div className="homePageContainer">
      <header className="homeNav">
        <h2 className="logoText">Gup-Shap</h2>

        <div className="navRight">
          <button className="historyBtn" onClick={() => navigate("/history")}>
            History
          </button>
          <button className="logoutBtn" onClick={logout}>Logout</button>
        </div>
      </header>

      <main className="homeMain">
        <div className="leftBlock">
          <h1 className="homeTitle">
            Providing <span className="accent">Quality</span> Video Calls
          </h1>

          <p className="subtitle">
            Enter a meeting code or create a new meeting to get started.
          </p>

          <div className="actionsRow">
            <input
              className="meetingInput"
              placeholder="Enter meeting code"
              value={meetingCode}
              onChange={(e) => setMeetingCode(e.target.value)}
            />

            <button className="btn-primary" onClick={handleJoin}>
              Join
            </button>

            <button className="btn-secondary" onClick={createNew}>
              New
            </button>
          </div>
        </div>

        <div className="rightBlock">
          <img src="/mobile.png" className="homeImage" alt="illustration" />
        </div>
      </main>
    </div>
  );
}
