// frontend/src/components/CallControls.jsx
import React from "react";
import "../styles/callControls.css";

export default function CallControls({
  micOn,
  camOn,
  isSharingScreen,
  onToggleMic,
  onToggleCam,
  onStartScreenShare,
  onStopScreenShare,
  onEndCall,
  onRaiseHand,
  isHost,
  participants,
  onApproveParticipant
}) {
  const pending = participants?.filter((p) => p.pending) || [];

  return (
    <div className="controlsWrap">
      
      {/* ---- MAIN BUTTON CONTROLS ---- */}
      <div className="controls">

        {/* Mic */}
        <button onClick={onToggleMic} className="control-btn">
          {micOn ? "Mute" : "Unmute"}
        </button>

        {/* Camera */}
        <button onClick={onToggleCam} className="control-btn">
          {camOn ? "Camera Off" : "Camera On"}
        </button>

        {/* Screen Share */}
        {!isSharingScreen ? (
          <button onClick={onStartScreenShare} className="control-btn">
            Share Screen
          </button>
        ) : (
          <button onClick={onStopScreenShare} className="control-btn stopScreen">
            Stop Share
          </button>
        )}

        {/* Raise Hand */}
        <button onClick={onRaiseHand} className="control-btn green">
          Raise Hand
        </button>

        {/* End Call */}
        <button onClick={onEndCall} className="control-btn red">
          End Call
        </button>

      </div>

      {/* ---- HOST APPROVALS ---- */}
      {isHost && (
        <div className="approvals">
          <div className="approveTitle">
            Pending approvals (click to approve):
          </div>

          {pending.length === 0 && (
            <div className="noPending">None</div>
          )}

          {pending.map((p) => (
            <div className="pendingItem" key={p.id}>
              <span className="pendingName">{p.username || p.id}</span>
              <button
                onClick={() => onApproveParticipant(p.id)}
                className="approveBtn"
              >
                Approve
              </button>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
