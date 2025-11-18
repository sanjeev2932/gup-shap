// frontend/src/pages/landing.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";

export default function LandingPage() {
  const router = useNavigate();
  return (
    <div>
      <nav className="navBar" style={{ padding: "18px 28px" }}>
        <div style={{ fontWeight: 700 }}>Gup-Shap</div>
        <div style={{ display: "flex", gap: 18 }}>
          <p style={{ cursor: "pointer" }} onClick={() => router("/aljk23")}>Join as Guest</p>
          <p style={{ cursor: "pointer" }} onClick={() => router("/auth")}>Register</p>
          <p style={{ cursor: "pointer" }} onClick={() => router("/auth")}>Login</p>
        </div>
      </nav>

      <div className="center-box" style={{ padding: "40px 80px" }}>
        <div style={{ display: "flex", gap: 80, alignItems: "center", width: "100%" }}>
          <div style={{ maxWidth: 640 }}>
            <h1 style={{ color: "#FF9839", marginBottom: 12 }}>Connect with your loved Ones</h1>
            <p className="small-muted">Cover the distance with Gup-Shap — fast, lightweight video calls.</p>
            <div style={{ marginTop: 18 }}>
              <Link to="/auth" className="btn">Get Started</Link>
            </div>
          </div>
          <div>
            <img src="/mobile.png" alt="mobile" style={{ width: 360, borderRadius: 6, boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
