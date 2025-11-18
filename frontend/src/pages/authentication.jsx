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

    const data = { name, username, password };
    const url = isLogin ? "/login" : "/register";

    const res = await post(url, data);

    if (!res.success) {
      setError(res.message || "Something went wrong");
      return;
    }

    localStorage.setItem("user", JSON.stringify(res.user));
    window.location.href = "/";
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
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </>
        )}

        <label>Username *</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} />

        <label>Password *</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
