import React from "react";
import "../index.css";
import { Link, useNavigate } from "react-router-dom";

export default function LandingPage() {
  const router = useNavigate();

  return (
    <div style={{ padding: 28 }}>
      {/* TOP NAVBAR */}
      <nav style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <h2>Gup-Shap</h2>

        <div style={{
          display: "flex",
          gap: 12,
          alignItems: "center"
        }}>
          <p
            style={{ cursor: "pointer" }}
            onClick={() => router("/aljk23")}
          >
            Join as Guest
          </p>

          <p
            style={{ cursor: "pointer" }}
            onClick={() => router("/auth")}
          >
            Register
          </p>

          <p
            style={{ cursor: "pointer" }}
            onClick={() => router("/auth")}
          >
            Login
          </p>
        </div>
      </nav>

      {/* HERO SECTION */}
      <div style={{
        display: "flex",
        gap: 40,
        alignItems: "center",
        marginTop: 80
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ color: "#FF9839" }}>Connect</h1>
          <p>Cover a distance by Gup-Shap</p>

          <Link
            to="/auth"
            style={{
              background: "#1976d2",
              color: "#fff",
              padding: "10px 14px",
              borderRadius: 8
            }}
          >
            Get Started
          </Link>
        </div>

        <div style={{ width: 360 }}>
          <img
            src="/mobile.png"
            alt="mobile"
            style={{ width: "100%" }}
          />
        </div>
      </div>
    </div>
  );
}
