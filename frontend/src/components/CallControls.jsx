// frontend/src/components/CallControls.jsx
import React, { useState, useEffect } from "react";
import "../styles/callControls.css";

export default function CallControls({
  localStream,
  onToggleMic,
  onToggleCam,
  onStartScreenShare,
  onStopScreenShare,
  onRaiseHand,
  isHost,
  onApproveParticipant // function(userId) only for host when lobby is on
}) {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [raised, setRaised] = useState(false);

  useEffect(() => {
    // reflect actual stream tracks state
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      const videoTrack = localStream.getVideoTracks()[0];
      setMicOn(!!audioTrack && audioTrack.enabled);
      setCamOn(!!videoTrack && videoTrack.enabled);
    }
  }, [localStream]);

  const toggleMic = () => {
    if (localStream) {
      const t = localStream.getAudioTracks()[0];
      if (t) {
        t.enabled = !t.enabled;
        setMicOn(t.enabled);
        if (onToggleMic) onToggleMic(t.enabled);
      }
    }
  };

  const toggleCam = () => {
    if (localStream) {
      const t = localStream.getVideoTracks()[0];
      if (t) {
        t.enabled = !t.enabled;
        setCamOn(t.enabled);
        if (onToggleCam) onToggleCam(t.enabled);
      }
    }
  };

  const toggleScreen = async () => {
    if (!sharing) {
      try {
        await onStartScreenShare();
        setSharing(true);
      } catch (e) {
        console.error("screen share failed", e);
      }
    } else {
      onStopScreenShare();
      setSharing(false);
    }
  };

  const toggleRaise = () => {
    const newVal = !raised;
    setRaised(newVal);
    if (onRaiseHand) onRaiseHand(newVal);
  };

  return (
    <div className="call-controls">
      <button className={"control-btn " + (micOn ? "" : "off")} onClick={toggleMic}>
        {micOn ? "Mic On" : "Mic Off"}
      </button>

      <button className={"control-btn " + (camOn ? "" : "off")} onClick={toggleCam}>
        {camOn ? "Cam On" : "Cam Off"}
      </button>

      <button className={"control-btn " + (sharing ? "sharing" : "")} onClick={toggleScreen}>
        {sharing ? "Stop Share" : "Share Screen"}
      </button>

      <button className={"control-btn " + (raised ? "raised" : "")} onClick={toggleRaise}>
        {raised ? "Lower Hand" : "Raise Hand"}
      </button>

      {isHost && (
        <div className="host-actions">
          <p>Host tools:</p>
          <div id="host-approve-list" /> {/* We'll populate via parent if needed */}
        </div>
      )}
    </div>
  );
}
