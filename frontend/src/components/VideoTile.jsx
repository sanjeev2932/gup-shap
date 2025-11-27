import React, { useEffect, useRef } from "react";

export default function VideoTile({
  id,
  username,
  stream,
  active = false,
  sharing = false,
  raised = false,
  pinned = false,
  onPin,        // callback from parent
  canKick = false,
  onKick,
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (stream) {
      try {
        v.srcObject = stream;
      } catch {
        v.src = URL.createObjectURL(stream);
      }
    } else {
      try {
        v.srcObject = null;
      } catch {}
      v.removeAttribute("src");
    }
  }, [stream]);

  return (
    <div
      className={
        "participantTile" +
        (sharing ? " screenTile" : "") +
        (active ? " active" : "") +
        (pinned ? " pinned" : "")
      }
      onClick={onPin ? () => onPin(id) : undefined}
      style={{ cursor: onPin ? "pointer" : "default", position: "relative" }}
      data-peer={id}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={id === "local"}
        className="remoteVideoEl"
      />

      <div className="tileLabel">{username || id}</div>

      {raised && <div className="raisedBadge">✋</div>}
      {pinned && <div className="pinBadge">📌</div>}

      {canKick && id !== "local" && (
        <button
          className="kickBtn"
          onClick={(e) => {
            e.stopPropagation();
            onKick && onKick(id);
          }}
        >
          Remove
        </button>
      )}
    </div>
  );
}
