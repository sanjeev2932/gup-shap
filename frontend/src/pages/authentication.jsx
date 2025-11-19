// frontend/src/pages/authentication.jsx
import React, { useState } from "react";
import "../styles/auth.css";
import { post } from "../utils/api";

const Authentication = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!username || !password || (!isLogin && !name)) {
      setError("Please fill required fields.");
      return;
    }

    const data = { name, username, password };
    const url = isLogin ? "/api/v1/users/login" : "/api/v1/users/register";

    const res = await post(url, data);
    if (!res || res.success === false) {
      setError(res?.message || "Authentication failed");
      return;
    }

    if (res.token) localStorage.setItem("token", res.token);
    if (res.user) localStorage.setItem("user", JSON.stringify(res.user));
    // redirect
    window.location.href = "/home";
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="auth-tabs">
          <button className={isLogin ? "active" : ""} onClick={() => setIsLogin(true)}>SIGN IN</button>
          <button className={!isLogin ? "active" : ""} onClick={() => setIsLogin(false)}>SIGN UP</button>
        </div>

        {!isLogin && (
          <>
            <label>Name</label>
            <input placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
          </>
        )}

        <label>Username</label>
        <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />

        <label>Password</label>
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />

        {error && <div className="auth-error">{error}</div>}

        <button className="auth-btn" onClick={handleSubmit}>{isLogin ? "LOGIN" : "REGISTER"}</button>
      </div>
    </div>
  );
};

export default Authentication;
