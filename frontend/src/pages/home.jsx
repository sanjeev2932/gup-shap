import React, { useContext, useState } from 'react'
import withAuth from '../utils/withAuth'
import { useNavigate } from 'react-router-dom'
import { Button, IconButton, TextField } from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import { AuthContext } from '../contexts/AuthContext';

function HomeComponent() {
  let navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState("");
  const { addToUserHistory } = useContext(AuthContext);

  let handleJoinVideoCall = async () => {
    if (!meetingCode) {
      // generate random if empty
      const gen = Math.random().toString(36).slice(2, 9);
      await addToUserHistory(gen);
      navigate(`/${gen}`);
      return;
    }
    await addToUserHistory(meetingCode);
    navigate(`/${meetingCode}`);
  }

  return (
    <>
      <div className="navBar bg-transparent flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Gup-Shap</h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/history")}>
            <IconButton><RestoreIcon /></IconButton>
            <p>History</p>
          </div>
          <Button onClick={() => { localStorage.removeItem("token"); navigate("/auth"); }}>
            Logout
          </Button>
        </div>
      </div>

      <div className="meetContainer container mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div className="leftPanel">
          <h2 className="text-3xl font-bold">Providing Quality Video Calls</h2>
          <p className="mt-2 text-slate-300">Enter a meeting code or create a new one to start a call.</p>

          <div className="mt-6 flex gap-3">
            <TextField onChange={e => setMeetingCode(e.target.value)} id="outlined-basic" label="Meeting Code" variant="outlined" />
            <Button onClick={handleJoinVideoCall} variant='contained'>Join</Button>
          </div>
        </div>

        <div className='rightPanel flex items-center justify-center'>
          <img src="/logo3.png" alt="logo" className="max-w-xs" />
        </div>
      </div>
    </>
  )
}

export default withAuth(HomeComponent)
