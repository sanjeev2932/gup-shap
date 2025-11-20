// frontend/src/pages/landing.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/landing.css";

export default function Landing() {
  const navigate = useNavigate();

  function handleStartMeeting() {
    const user = localStorage.getItem("user");
    if (user) navigate("/home");
    else navigate("/auth#signin");
  }

  function handleJoin() {
    navigate("/join");  // ✅ FIXED — correct route
  }

  function openAuth(tab = "signin") {
    navigate(`/auth#${tab}`);
  }

  return (
    <div className="landingWrapper">

      {/* NAVBAR */}
      <nav className="landingNavbar">
        <div className="navLogo">Gup-Shap</div>

        <div className="navActions">
          <button
            className="bubbleBtn white"
            onClick={() => openAuth("signin")}
          >
            Register / Login
          </button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="heroSection">

        {/* LEFT */}
        <div className="heroLeft">
          <h1 className="heroTitle">
            <span className="colorBlue">Connect.</span>
            <span className="colorPurple"> Laugh.</span>
            <span className="colorMango"> Talk.</span>
            <br />
            <span className="colorNeon">Gup-Shap.</span>
          </h1>

          <p className="heroSubtitle">
            Fast, friendly, colorful video calls for everyone.
          </p>

          <div className="heroButtons">
            <button className="bubbleBtn primary" onClick={handleStartMeeting}>
              Start a Meeting
            </button>

            <button className="bubbleBtn outline" onClick={handleJoin}>
              Join with Code
            </button>
          </div>
        </div>

        {/* RIGHT */}
        <div className="heroRight">
          <img
            src="/hero-phones.png"
            alt="illustration"
            className="heroIllustration"
          />
        </div>
      </section>

      {/* FLOATING SHAPES */}
      <div className="bgShape shape1"></div>
      <div className="bgShape shape2"></div>
      <div className="bgShape shape3"></div>
    </div>
  );
}
