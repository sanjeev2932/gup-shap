// frontend/src/pages/landing.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/landing.css";

export default function Landing() {
  const navigate = useNavigate();

  function handleGetStarted() {
    // If user logged in, go to /home otherwise go to /authentication
    const user = localStorage.getItem("user");
    if (user) navigate("/home");
    else navigate("/auth#signin");
  }

  function handleJoinExisting() {
    navigate("/joinExisting");
  }

  function openAuth(tab = "signin") {
    // anchor with hash to force tab open
    navigate(`/auth#${tab}`);
  }

  return (
    <div className="landingPageContainer">
      <nav className="landingNav">
        <div className="navHeader">
          <h2>Gup-Shap</h2>
        </div>
        <div className="navlist">
          <button className="link-btn" onClick={() => openAuth("signin")}>Register / Login</button>
        </div>
      </nav>

      <div className="landingMainContainer">
        <div className="landingLeft">
          <h1><span className="accent">Connect</span> with your loved Ones</h1>
          <p>Cover the distance with Gup-Shap — fast, lightweight video calls in a clean, modern UI.</p>

          <div className="ctaRow">
            <button className="btn-primary large" onClick={handleGetStarted}>Get Started</button>
            <button className="btn-outline" onClick={handleJoinExisting}>Join existing</button>
          </div>
        </div>

        <div className="landingRight" aria-hidden>
          <img src="/hero-phones.png" alt="phones" />
        </div>
      </div>
    </div>
  );
}
