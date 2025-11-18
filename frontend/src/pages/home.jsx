// frontend/src/pages/home.jsx
import React, { useContext, useState } from "react";
import withAuth from "../utils/withAuth";
import { useNavigate } from "react-router-dom";
import { Button, IconButton, TextField } from "@mui/material";
import RestoreIcon from "@mui/icons-material/Restore";
import { AuthContext } from "../contexts/AuthContext";
import "../App.css";

function HomeComponent() {
  let navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState("");
  const { addToUserHistory, logout } = useContext(AuthContext);

  let handleJoinVideoCall = async () => {
    if (!meetingCode) meetingCode = Math.random().toString(36).slice(2, 8);
    await addToUserHistory(meetingCode);
    navigate(`/${meetingCode}`);
  };

  return (
    <>
      <div className="navBar">
        <div style={{ display: "flex", alignItems: "center" }}>
          <h2>Gup-Shap</h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <IconButton onClick={() => navigate("/history")}>
            <RestoreIcon />
          </IconButton>
          <p>History</p>
          <Button onClick={() => { logout(); navigate("/auth"); }}>
            Logout
          </Button>
        </div>
      </div>

      <div className="meetContainer" style={{ display: "flex", padding: "40px" }}>
        <div className="leftPanel" style={{ flex: 1 }}>
          <h2>Providing Quality Video Calls</h2>
          <div style={{ display: 'flex', gap: "10px", marginTop: 16 }}>
            <TextField value={meetingCode} onChange={e => setMeetingCode(e.target.value)} id="outlined-basic" label="Meeting Code" variant="outlined" />
            <Button onClick={handleJoinVideoCall} variant="contained">Join</Button>
          </div>
        </div>

        <div className='rightPanel' style={{ width: 420, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <img srcSet='/logo3.png' alt="logo" style={{ width: 270 }} />
        </div>
      </div>
    </>
  );
}

export default withAuth(HomeComponent);
