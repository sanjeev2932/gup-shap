import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/home.css";

export default function Home() {
  const navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("token"));

  useEffect(() => {
    document.body.classList.remove("dark-meeting");
    document.body.classList.add("light-mode");

    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);
  }, []);

  // Meeting actions: require login, but do NOT redirect on page load
  const handleJoin = () => {
    const code = meetingCode.trim();
    if (!code) return alert("Enter a valid meeting code.");
    const token = localStorage.getItem("token");
    if (!token) {
      alert("You must sign in first.");
      navigate("/auth#signin");
      return;
    }
    navigate(`/meet/${code}`);
  };

  const createNew = () => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("You must sign in first.");
      navigate("/auth#signin");
      return;
    }
    const rnd = Math.random().toString(36).substring(2, 9);
    navigate(`/meet/${rnd}`);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setIsLoggedIn(false);
    navigate("/");
  };

  const login = () => navigate("/auth#signin");
  const register = () => navigate("/auth#signup");

  return (
    <div className="homePageContainer">
      {/* HEADER */}
      <header className="homeNav">
        <h2 className="logoText">Gup-Shap</h2>
        <div className="navRight">
          {isLoggedIn ? (
            <>
              <button className="historyBtn" onClick={() => navigate("/history")}>History</button>
              <button className="logoutBtn" onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <button className="loginBtn" onClick={login}>Login</button>
              <button className="registerBtn" onClick={register}>Register</button>
            </>
          )}
        </div>
      </header>
      {/* MAIN */}
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
            <button className="btn-primary" onClick={handleJoin}>Join</button>
            <button className="btn-secondary" onClick={createNew}>New</button>
          </div>
        </div>
        {/* RIGHT SIDE IMAGE */}
        <div className="rightBlock">
          <img src="/mobile.png" className="homeImage" alt="illustration" />
        </div>
      </main>
    </div>
  );
}
