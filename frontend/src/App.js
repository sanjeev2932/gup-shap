// src/App.js

import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";

import Landing from "./pages/landing";
import Authentication from "./pages/authentication.jsx";
import Home from "./pages/home.jsx";
import JoinExisting from "./pages/joinExisting.jsx";
import VideoMeet from "./pages/VideoMeet.jsx";
import History from "./pages/history.jsx";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Authentication />} />
          <Route path="/home" element={<Home />} />
          <Route path="/joinExisting" element={<JoinExisting />} />
          <Route path="/history" element={<History />} />
          <Route path="/meet/:roomId" element={<VideoMeet />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
