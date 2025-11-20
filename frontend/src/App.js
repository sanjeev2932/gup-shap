// frontend/src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Landing from "./pages/landing";
import Authentication from "./pages/authentication";
import Home from "./components/HomeComponent";   // FIX: use the new HomeComponent
import VideoMeet from "./pages/VideoMeet";

function App() {
  return (
    <Router>
      <Routes>

        {/* Public landing page */}
        <Route path="/" element={<Landing />} />

        {/* Login / Signup */}
        <Route path="/auth" element={<Authentication />} />

        {/* Home AFTER login */}
        <Route path="/home" element={<Home />} />

        {/* Meeting */}
        <Route path="/:roomId" element={<VideoMeet />} />

      </Routes>
    </Router>
  );
}

export default App;
