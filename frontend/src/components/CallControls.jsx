// frontend/src/components/CallControls.jsx
import React from "react";
import "../styles/callControls.css";

export default function CallControls({
  micOn, camOn, isSharingScreen,
  onToggleMic, onToggleCam, onStartScreenShare,
  onEndCall, onRaiseHand,
  isHost, participants, onApproveParticipant
}) {
  const pending = participants.filter(p => p.pending);
  return (
    <div className="controlsWrap">
      <div className="controls">
        <button onClick={onToggleMic} className="control-btn">{micOn ? "Mute" : "Unmute"}</button>
        <button onClick={onToggleCam} className="control-btn">{camOn ? "Camera Off" : "Camera On"}</button>
        <button onClick={onStartScreenShare} className="control-btn">{isSharingScreen ? "Stop Share" : "Share Screen"}</button>
        <button onClick={onRaiseHand} className="control-btn green">Raise Hand</button>
        <button onClick={onEndCall} className="control-btn red">End Call</button>
      </div>

      {isHost && (
        <div className="approvals">
          <div className="approveTitle">Pending approvals (click to approve):</div>
          {pending.length === 0 && <div className="noPending">None</div>}
          {pending.map(p => (
            <div className="pendingItem" key={p.id}>
              <span className="pendingName">{p.username || p.id}</span>
              <button onClick={() => onApproveParticipant(p.id)} className="approveBtn">Approve</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
