import React, { useEffect, useRef } from "react";

export default function VideoTile({
  id,
  username,
  stream,
  active = false,
  sharing = false,
  raised = false,
  pinned = false,
  onPin, // callback from parent
}) {
  const videoRef = useRef();

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
      style={{ cursor: onPin ? "pointer" : "default" }}
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
    </div>
  );
}
