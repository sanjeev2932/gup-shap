// frontend/src/App.js
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Authentication from "./pages/Authentication";
import JoinExisting from "./pages/JoinExisting";
import VideoMeet from "./pages/VideoMeet";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<Authentication />} />
        <Route path="/join" element={<JoinExisting />} />
        <Route path="/:roomId" element={<VideoMeet />} />
      </Routes>
    </BrowserRouter>
  );
}
