// frontend/src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Landing from "./pages/landing";
import Authentication from "./pages/authentication";
import Home from "./pages/home";        // ✅ CORRECT IMPORT
import VideoMeet from "./pages/VideoMeet";
import JoinExisting from "./pages/joinExisting";  // ✅ Only if needed
import History from "./pages/history";            // Optional if you have it

function App() {
  return (
    <Router>
      <Routes>

        {/* Public Landing Page */}
        <Route path="/" element={<Landing />} />

        {/* Login / Signup */}
        <Route path="/auth" element={<Authentication />} />

        {/* User Home Page */}
        <Route path="/home" element={<Home />} />

        {/* Join With Code Page */}
        <Route path="/joinExisting" element={<JoinExisting />} />

        {/* Meeting Page */}
        <Route path="/meet/:roomId" element={<VideoMeet />} />

        {/* History (optional) */}
        <Route path="/history" element={<History />} />

      </Routes>
    </Router>
  );
}

export default App;
