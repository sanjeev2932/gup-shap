// frontend/src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Landing from "./pages/landing";
import Authentication from "./pages/authentication";
import Home from "./pages/home";
import JoinExisting from "./pages/joinExisting";
import VideoMeet from "./pages/VideoMeet";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Authentication />} />
        <Route path="/home" element={<Home />} />
        <Route path="/join" element={<JoinExisting />} />
        <Route path="/:roomId" element={<VideoMeet />} />
      </Routes>
    </Router>
  );
}

export default App;
