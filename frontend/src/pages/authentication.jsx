// frontend/src/pages/authentication.jsx
import React, { useState } from "react";
import "../index.css";

export default function Authentication() {
  const [isSignIn, setIsSignIn] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e) => {
    e.preventDefault();
    // keep it simple: store dummy token and go to home
    localStorage.setItem("token", "dummy-token");
    window.location.href = "/home";
  };

  return (
    <div className="page-center">
      <div className="auth-card">
        <div className="auth-tabs">
          <button className={`tab ${isSignIn ? "active" : ""}`} onClick={() => setIsSignIn(true)}>SIGN IN</button>
          <button className={`tab ${!isSignIn ? "active" : ""}`} onClick={() => setIsSignIn(false)}>SIGN UP</button>
        </div>

        <form onSubmit={submit} className="auth-form">
          <label>Username *</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />

          <label>Password *</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

          <button className="btn primary" type="submit">LOGIN</button>
        </form>
      </div>
    </div>
  );
}
