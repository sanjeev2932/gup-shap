// frontend/src/pages/authentication.jsx
import React, { useEffect, useState } from "react";
import "../styles/auth.css";
import { post } from "../utils/api";
import { useNavigate, useLocation } from "react-router-dom";

const Authentication = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { hash } = useLocation();

  useEffect(() => {
    // Support direct links: /auth#signup or /auth#signin
    if (hash && hash.includes("signup")) setIsLogin(false);
    else setIsLogin(true);
  }, [hash]);

  useEffect(() => {
    setError("");
  }, [isLogin, name, username, password]);

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setError("");
    if (!username || !password || (!isLogin && !name)) {
      setError("Please fill required fields.");
      return;
    }
    const data = { name, username, password };
    const url = isLogin ? "/api/v1/users/login" : "/api/v1/users/register";

    const res = await post(url, data);
    if (!res || res.success === false) {
      setError(res?.message || "Server error");
      return;
    }

    // Save token and user if backend returned
    if (res.token) localStorage.setItem("token", res.token);
    if (res.user) localStorage.setItem("user", JSON.stringify(res.user));
    // go to home
    navigate("/home");
  };

  return (
    <div className="auth-container">
      <form className="auth-box" onSubmit={handleSubmit}>
        <div className="tabs">
          <button
            type="button"
            className={isLogin ? "tab active" : "tab"}
            onClick={() => { setIsLogin(true); window.location.hash = "signin"; }}
          >
            SIGN IN
          </button>
          <button
            type="button"
            className={!isLogin ? "tab active" : "tab"}
            onClick={() => { setIsLogin(false); window.location.hash = "signup"; }}
          >
            SIGN UP
          </button>
        </div>

        {!isLogin && (
          <>
            <label>Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" />
          </>
        )}

        <label>Username *</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter username" />

        <label>Password *</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" />

        {error && <p className="error">{error}</p>}

        <button className="btn" type="submit">{isLogin ? "LOGIN" : "REGISTER"}</button>
      </form>
    </div>
  );
};

export default Authentication;
