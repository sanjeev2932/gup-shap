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

  // Detect #signin or #signup
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

    // PAYLOAD
    const payload = isLogin
      ? { username, password }
      : { name, username, password };

    // FIXED URL (NO /api/)
    const url = isLogin
      ? "/users/login"
      : "/users/register";

    const res = await post(url, payload);

    if (!res || !res.success) {
      setError(res?.message || "Server error.");
      return;
    }

    // SAVE LOGIN INFO
    if (res.token) localStorage.setItem("token", res.token);
    if (res.user) localStorage.setItem("user", JSON.stringify(res.user));

    navigate("/home");
  };

  const openSignIn = () => {
    setIsLogin(true);
    navigate("/auth#signin");
  };

  const openSignUp = () => {
    setIsLogin(false);
    navigate("/auth#signup");
  };

  return (
    <div className="authPage">
      <header className="authHeader">
        <h2 className="logoText">Gup-Shap</h2>
        <button className="backBtn" onClick={() => navigate("/")}>← Back</button>
      </header>

      <div className="authCard">
        <div className="authTabs">
          <button className={isLogin ? "tab active" : "tab"} onClick={openSignIn}>
            Sign In
          </button>

          <button className={!isLogin ? "tab active" : "tab"} onClick={openSignUp}>
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
