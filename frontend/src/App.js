import React, { useEffect } from "react";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import LandingPage from "./pages/landing";
import Authentication from "./pages/authentication";
import VideoMeetComponent from "./pages/VideoMeet";
import HomeComponent from "./pages/home";

/*
  This App uses a mixed theme:
  - Landing / Auth / Home => light mode
  - VideoMeet => dark mode
  We set a body class on mount of each page (pages manage it).
*/

function App() {
  useEffect(() => {
    // default to light mode
    document.body.classList.remove("dark-meeting");
    document.body.classList.add("light-mode");
  }, []);

  return (
    <div className="App min-h-screen">
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<Authentication />} />
          <Route path="/home" element={<HomeComponent />} />
          <Route path="/:url" element={<VideoMeetComponent />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
