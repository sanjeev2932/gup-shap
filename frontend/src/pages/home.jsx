import React, { useContext, useState } from "react";
import withAuth from "../utils/withAuth";
import { useNavigate } from "react-router-dom";
import { Button, IconButton, TextField } from "@mui/material";
import RestoreIcon from "@mui/icons-material/Restore";
import { AuthContext } from "../contexts/AuthContext";
import "../index.css";

function Home() {
  const navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState("");
  const { addToUserHistory } = useContext(AuthContext);

  const handleJoinVideoCall = async () => {
    if (!meetingCode || meetingCode.trim() === "") {
      alert("Please enter meeting code (or create a new one in URL).");
      return;
    }
    await addToUserHistory(meetingCode);
    navigate(`/${meetingCode}`);
  };

  return (
    <>
      <div className="navBar">
        <div className="navLeft"><h2>Gup-Shap</h2></div>
        <div className="navRight">
          <IconButton onClick={() => navigate("/history")} title="History"><RestoreIcon /></IconButton>
          <Button onClick={() => { localStorage.removeItem("token"); navigate("/auth"); }}>Logout</Button>
        </div>
      </div>

      <div className="meetContainer">
        <div className="leftPanel">
          <h2>Providing Quality Video Calls</h2>
          <p>Enter a meeting code or create a new one to start a call.</p>
          <div style={{ display: "flex", gap: 12 }}>
            <TextField onChange={(e) => setMeetingCode(e.target.value)} id="meetingCode" label="Meeting Code" variant="outlined" size="small" />
            <Button variant="contained" onClick={handleJoinVideoCall}>Join</Button>
          </div>
        </div>

        <div className="rightPanel">
          <img src="/logo3.png" alt="logo" style={{ maxWidth: 320 }} />
        </div>
      </div>
    </>
  );
}

export default withAuth(Home);
