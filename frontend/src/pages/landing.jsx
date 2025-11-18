import React from "react";
import "../index.css";

export default function LandingPage() {
  return (
    <div className="landing">
      <nav className="nav">
        <div className="brand">Gup-Shap</div>
        <div className="navLinks">
          <a href="/auth">Register</a>
          <a href="/auth">Login</a>
        </div>
      </nav>

      <section className="hero">
        <div className="heroLeft">
          <h1><span className="accent">Connect</span> with your loved Ones</h1>
          <p>Cover the distance with Gup-Shap — fast, lightweight video calls.</p>
          <a className="btn" href="/auth">Get Started</a>
        </div>

        <div className="heroRight">
          <img src="/mobile.png" alt="mobile preview" />
        </div>
      </section>
    </div>
  );
}
