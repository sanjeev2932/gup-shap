// frontend/src/components/CallControls.jsx
import React from "react";
import "../styles/callControls.css";

export default function CallControls({
  micOn,
  camOn,
  isSharingScreen,
  onToggleMic,
  onToggleCam,
  onStartScreenShare, // toggle-style handler (start/stop)
  onEndCall,
  onRaiseHand,
  isHost,
  participants = [],
  onApproveParticipant
}) {
  const pending = participants.filter((p) => p.pending) || [];

  return (
    <div className="gs-controlsWrap" role="group" aria-label="Call controls">
      <div className="gs-controlsBubble" role="toolbar" aria-label="Main controls">

        {/* Mic */}
        <button
          onClick={onToggleMic}
          className={`gs-btn gs-btn-main ${micOn ? "on" : "off"}`}
          title={micOn ? "Mute mic" : "Unmute mic"}
        >
          <span className="gs-icon">🎙</span>
          <span className="gs-label">{micOn ? "Mute" : "Unmute"}</span>
        </button>

        {/* Camera */}
        <button
          onClick={onToggleCam}
          className={`gs-btn gs-btn-main ${camOn ? "on" : "off"}`}
          title={camOn ? "Turn camera off" : "Turn camera on"}
        >
          <span className="gs-icon">📷</span>
          <span className="gs-label">{camOn ? "Camera Off" : "Camera On"}</span>
        </button>

        {/* Screen Share (toggle) */}
        <button
          onClick={onStartScreenShare}
          className={`gs-btn gs-btn-accent ${isSharingScreen ? "sharing" : ""}`}
          title={isSharingScreen ? "Stop sharing screen" : "Share screen"}
        >
          <span className="gs-icon">🖥️</span>
          <span className="gs-label">{isSharingScreen ? "Stop Share" : "Share Screen"}</span>
        </button>

        {/* Raise Hand */}
        <button
          onClick={onRaiseHand}
          className="gs-btn gs-btn-ghost"
          title="Raise hand"
        >
          <span className="gs-icon">✋</span>
          <span className="gs-label">Raise Hand</span>
        </button>

        {/* End Call */}
        <button
          onClick={onEndCall}
          className="gs-btn gs-btn-danger"
          title="End call"
        >
          <span className="gs-icon">✖️</span>
          <span className="gs-label">End Call</span>
        </button>
      </div>

      {/* Host approvals panel */}
      {isHost && (
        <div className="gs-approvals" aria-live="polite" aria-label="Pending approvals">
          <div className="gs-approveTitle">Pending approvals</div>

          {pending.length === 0 ? (
            <div className="gs-noPending">None</div>
          ) : (
            <div className="gs-pendingList">
              {pending.map((p) => (
                <div className="gs-pendingItem" key={p.id}>
                  <div className="gs-pendingMeta">
                    <div className="gs-pendingAvatar">
                      {p.username ? p.username.charAt(0).toUpperCase() : "?"}
                    </div>
                    <div className="gs-pendingName">{p.username || p.id}</div>
                  </div>

                  <button
                    onClick={() => onApproveParticipant(p.id)}
                    className="gs-approveBtn"
                    aria-label={`Approve ${p.username || p.id}`}
                  >
                    Approve
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
