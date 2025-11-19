// frontend/src/components/CallControls.jsx
import React from "react";
import "../styles/videoComponent.css";

export default function CallControls({
  micOn,
  camOn,
  isSharingScreen,
  onToggleMic,
  onToggleCam,
  onStartScreenShare,
  onEndCall,
  onRaiseHand,
  isHost,
  participants,
  onApproveParticipant
}) {
  return (
    <div className="controls-bar">
      <button className={`control-btn ${micOn ? "" : "off"}`} onClick={onToggleMic}>
        {micOn ? "Mute" : "Unmute"}
      </button>

      <button className={`control-btn ${camOn ? "" : "off"}`} onClick={onToggleCam}>
        {camOn ? "Camera Off" : "Camera On"}
      </button>

      <button className="control-btn" onClick={onStartScreenShare}>
        {isSharingScreen ? "Stop Share" : "Share Screen"}
      </button>

      <button className="control-btn end" onClick={onEndCall}>
        End Call
      </button>

      <button className="control-btn" onClick={onRaiseHand}>
        Raise Hand
      </button>

      {isHost && participants && participants.length > 0 && (
        <div className="host-panel">
          <small>Pending approvals (click to approve):</small>
          <div className="host-requests">
            {participants
              .filter(p => p.id && p.pending)
              .map(p => (
                <button key={p.id} onClick={() => onApproveParticipant(p.id)} className="approve-btn">
                  Approve {p.username || p.id}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
