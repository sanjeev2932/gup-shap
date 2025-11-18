import React, { useState } from "react";
import "../index.css";

export default function Authentication() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // NOTE: keep your existing auth API calls here.
  const submit = (e) => {
    e.preventDefault();
    alert(`(demo) ${isSignUp ? "Signing up" : "Logging in"}: ${username}`);
    // implement call to backend register/login and save token, then redirect.
  };

  return (
    <div className="authPage">
      <form className="authCard" onSubmit={submit}>
        <div className="authTabs">
          <button type="button" className={`tab ${!isSignUp ? "active" : ""}`} onClick={() => setIsSignUp(false)}>SIGN IN</button>
          <button type="button" className={`tab ${isSignUp ? "active" : ""}`} onClick={() => setIsSignUp(true)}>SIGN UP</button>
        </div>

        <div className="field">
          <label>Username *</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>

        <div className="field">
          <label>Password *</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        <button className="btn primary" type="submit">LOGIN</button>
      </form>
    </div>
  );
}
