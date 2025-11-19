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

    // 🔥 FIX: Correct backend endpoints
    const url = isLogin
      ? "/api/v1/users/login"
      : "/api/v1/users/register";

    try {
      const res = await post(url, data);

      if (!res || res.success === false) {
        setError(res?.message || "Authentication failed");
        return;
      }

      // Save token and user
      if (res.token) localStorage.setItem("token", res.token);
      if (res.user) localStorage.setItem("user", JSON.stringify(res.user));

      window.location.href = "/home";
    } catch (err) {
      setError("Server error. Try again.");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="tabs">
          <button
            className={isLogin ? "active" : ""}
            onClick={() => setIsLogin(true)}
          >
            SIGN IN
          </button>
          <button
            className={!isLogin ? "active" : ""}
            onClick={() => setIsLogin(false)}
          >
            SIGN UP
          </button>
        </div>

        {!isLogin && (
          <>
            <label>Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
            />
          </>
        )}

        <label>Username *</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter username"
        />

        <label>Password *</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
        />

        {error && <p className="error">{error}</p>}

        <button className="btn" onClick={handleSubmit}>
          {isLogin ? "LOGIN" : "REGISTER"}
        </button>
      </div>
    </div>
  );
};

export default Authentication;
