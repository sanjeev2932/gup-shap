// frontend/src/pages/authentication.jsx

import React, { useEffect, useState } from "react";
import "../styles/authNew.css";
import { post } from "../utils/api";
import { useNavigate, useLocation } from "react-router-dom";

export default function Authentication() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const h = (location.hash || "").replace("#", "");
    setIsLogin(h !== "signup");
  }, [location.hash]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username || !password || (!isLogin && !name)) {
      setError("Please fill all required fields.");
      return;
    }

    const payload = isLogin
      ? { username, password }
      : { name, username, password };

    const url = isLogin ? "/users/login" : "/users/register";

    const res = await post(url, payload);

    console.log("API Response:", res); // for debugging

    // FIXED: treat only explicit failures as failure
    if (!res || res.success === false) {
      setError(res?.message || "Server error.");
      return;
    }

    setError(""); // clear previous error

    if (res.token) localStorage.setItem("token", res.token);
    if (res.user) localStorage.setItem("user", JSON.stringify(res.user));

    navigate("/home");
  };

  return (
    <div className="authPage">
      <header className="authHeader">
        <h2 className="logoText">chatarpatar</h2>
        <button className="backBtn" onClick={() => navigate("/")}>
          ← Back
        </button>
      </header>

      <div className="authCard">
        <div className="authTabs">
          <button
            className={isLogin ? "tab active" : "tab"}
            onClick={() => navigate("/auth#signin")}
          >
            Sign In
          </button>

          <button
            className={!isLogin ? "tab active" : "tab"}
            onClick={() => navigate("/auth#signup")}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="authForm">
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

          {error && <p className="authError">{error}</p>}

          <button type="submit" className="authBtn">
            {isLogin ? "Login" : "Register"}
          </button>
        </form>
      </div>
    </div>
  );
}
