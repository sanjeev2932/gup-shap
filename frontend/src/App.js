// frontend/src/App.js
import "./index.css";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import LandingPage from "./pages/landing";
import Authentication from "./pages/authentication";
import VideoMeetComponent from "./pages/VideoMeet";
import HomeComponent from "./pages/home";

function App() {
  return (
    <div className="App">
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
