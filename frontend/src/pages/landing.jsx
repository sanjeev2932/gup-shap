// frontend/src/pages/landing.jsx
import React from "react";
import "../index.css";
import { Link, useNavigate } from "react-router-dom";

export default function LandingPage() {
  const navigate = useNavigate();
  return (
    <div className="landing-root">
      <nav className="topbar">
        <div className="logo">Gup-Shap</div>
        <div className="nav-right">
          <button className="link" onClick={() => navigate("/auth")}>Register / Login</button>
        </div>
      </nav>

      <div className="landing-main">
        <div className="landing-text">
          <h1><span className="accent">Connect</span> with your loved ones</h1>
          <p>Cover a distance with Gup-Shap</p>
          <Link to="/auth"><button className="btn primary">Get Started</button></Link>
        </div>

        <div className="landing-art">
          <img src="/mobile.png" alt="mobile" />
        </div>
      </div>
    </div>
  );
}
