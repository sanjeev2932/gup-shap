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
  onEndCall,
  onRaiseHand,
  isHost,
  participants,
  onApproveParticipant
}) {
  // split pending members for host view
  const pending = (participants || []).filter(p => p.pending);

  return (
    <div className="gs-controlsWrap">
      <div className="gs-controlsBubble">
        <button
          onClick={onToggleMic}
          className={`gs-btn gs-btn-main ${micOn ? "on" : "off"}`}
          title={micOn ? "Mute / Unmute mic" : "Unmute / Mute mic"}
        >
          <div className="gs-icon">{micOn ? "🎙️" : "🔇"}</div>
          <div className="gs-label">{micOn ? "Mute" : "Unmute"}</div>
        </button>

        <button
          onClick={onToggleCam}
          className={`gs-btn gs-btn-main ${camOn ? "on" : "off"}`}
          title={camOn ? "Turn camera off" : "Turn camera on"}
        >
          <div className="gs-icon">{camOn ? "📷" : "🚫"}</div>
          <div className="gs-label">{camOn ? "Cam Off" : "Cam On"}</div>
        </button>

        <button
          onClick={onStartScreenShare}
          className={`gs-btn gs-btn-accent ${isSharingScreen ? "sharing" : ""}`}
          title={isSharingScreen ? "Stop screen share" : "Share your screen"}
        >
          <div className="gs-icon">🖥️</div>
          <div className="gs-label">{isSharingScreen ? "Stop Share" : "Share"}</div>
        </button>

        <button
          onClick={onRaiseHand}
          className="gs-btn gs-btn-ghost"
          title="Raise hand"
        >
          <div className="gs-icon">✋</div>
          <div className="gs-label">Raise</div>
        </button>

        <button
          onClick={onEndCall}
          className="gs-btn gs-btn-danger"
          title="End call"
        >
          <div className="gs-icon">⛔</div>
          <div className="gs-label">End</div>
        </button>
      </div>

      {/* Host approvals panel */}
      {isHost && (
        <div className="gs-approvals">
          <div className="gs-approveTitle">Pending approvals</div>

          {pending.length === 0 ? (
            <div className="gs-noPending">No pending requests</div>
          ) : (
            <div className="gs-pendingList">
              {pending.map((p) => (
                <div className="gs-pendingItem" key={p.id}>
                  <div className="gs-pendingMeta">
                    <div className="gs-pendingAvatar">{(p.username || "U").slice(0,1)}</div>
                    <div className="gs-pendingName">{p.username || p.id}</div>
                  </div>

                  <button
                    onClick={() => onApproveParticipant(p.id)}
                    className="gs-approveBtn"
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
