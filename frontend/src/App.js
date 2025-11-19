// frontend/src/App.js
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Authentication from "./pages/Authentication";
import JoinExisting from "./pages/JoinExisting";
import VideoMeet from "./pages/VideoMeet";

/*
  Main router. NOTE:
  - / => landing
  - /auth => login/register
  - /join => join existing page
  - /:roomId => dynamic room page (VideoMeet)
*/

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Authentication />} />
        <Route path="/join" element={<JoinExisting />} />
        <Route path="/:roomId" element={<VideoMeet />} />
      </Routes>
    </BrowserRouter>
  );
}
