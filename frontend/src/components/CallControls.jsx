// frontend/src/components/CallControls.jsx
import React from "react";
import "../styles/callControls.css";

export default function CallControls({
  micOn,
  camOn,
  onToggleMic,
  onToggleCam,
  onStartScreenShare,
  onStopScreenShare,
  onEndCall,
  isSharingScreen,
}) {
  return (
    <div className="gs-controlsWrap" role="group" aria-label="Call controls">
      <div className="gs-controlsBubble" role="toolbar">

        {/* Mic */}
        <button
          onClick={onToggleMic}
          className={`gs-btn gs-btn-main ${micOn ? "on" : "off"}`}
        >
          🎙 {micOn ? "Mute" : "Unmute"}
        </button>

        {/* Camera */}
        <button
          onClick={onToggleCam}
          className={`gs-btn gs-btn-main ${camOn ? "on" : "off"}`}
        >
          📷 {camOn ? "Cam Off" : "Cam On"}
        </button>

        {/* Screen Share */}
        {!isSharingScreen ? (
          <button
            onClick={onStartScreenShare}
            className="gs-btn gs-btn-accent"
          >
            🖥️ Share Screen
          </button>
        ) : (
          <button
            onClick={onStopScreenShare}
            className="gs-btn gs-btn-accent sharing"
          >
            🛑 Stop Share
          </button>
        )}

        {/* End call */}
        <button
          onClick={onEndCall}
          className="gs-btn gs-btn-danger"
        >
          ❌ End Call
        </button>

      </div>
    </div>
  );
}
