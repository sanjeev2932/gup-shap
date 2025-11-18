// frontend/src/pages/authentication.jsx
import React, { useContext, useState } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import "../App.css";

export default function Authentication() {
  const { login, register } = useContext(AuthContext);
  const [mode, setMode] = useState("signin"); // signin/signup
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const nav = useNavigate();

  const handleLogin = async () => {
    const res = await login(username, password);
    if (res.ok) nav("/home");
    else setError(res.message || "Failed");
  };

  const handleRegister = async () => {
    const res = await register(name, username, password);
    if (res.ok) {
      setMode("signin");
      setError("Registered. Now login.");
    } else setError(res.message || "Failed to register");
  };

  return (
    <div>
      <div className="navBar">
        <div style={{ fontWeight: 700 }}>Gup-Shap</div>
        <div style={{ color: "#aab" }}>Register / Login</div>
      </div>

      <div className="center-box">
        <div className="card" style={{ width: 420 }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 18 }}>
            <button className="btn" style={{ background: mode === "signin" ? "#1572e8" : "#1f2430" }} onClick={() => setMode("signin")}>SIGN IN</button>
            <button className="btn" style={{ background: mode === "signup" ? "#1572e8" : "#1f2430" }} onClick={() => setMode("signup")}>SIGN UP</button>
          </div>

          {error && <div style={{ color: "#ffb4b4", marginBottom: 12 }}>{error}</div>}

          {mode === "signup" && (
            <div style={{ marginBottom: 10 }}>
              <label className="small-muted">Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 6, marginTop: 6 }} placeholder="Full name" />
            </div>
          )}

          <div style={{ marginBottom: 10 }}>
            <label className="small-muted">Username *</label>
            <input value={username} onChange={e => setUsername(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 6, marginTop: 6 }} placeholder="username" />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label className="small-muted">Password *</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 6, marginTop: 6 }} placeholder="password" />
          </div>

          {mode === "signin" ? (
            <button className="btn" onClick={handleLogin}>LOGIN</button>
          ) : (
            <button className="btn" onClick={handleRegister}>REGISTER</button>
          )}
        </div>
      </div>
    </div>
  );
}
