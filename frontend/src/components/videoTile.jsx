// frontend/src/components/VideoTile.jsx
import React, { useEffect, useRef } from "react";

export default function VideoTile({
  id,
  username,
  stream,         // MediaStream object (may be undefined until attached)
  active = false, // boolean - active speaker spotlight
  sharing = false,// boolean - screen sharing by this user
  raised = false, // boolean - raised hand
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
      // clear
      try { v.srcObject = null; } catch {}
      v.removeAttribute("src");
    }
  }, [stream]);

  return (
    <div
      className={`participantTile ${sharing ? "screenTile" : ""} ${active ? "active" : ""}`}
      data-peer={id}
      data-active={active ? "true" : "false"}
      data-screenshare={sharing ? "true" : "false"}
      role="group"
      aria-label={username || id}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={id === "local"} /* local preview muted so you don't echo */
        className="remoteVideoEl"
      />
      <div className="tileLabel">{username || id}</div>
      {raised && <div className="raisedBadge" aria-hidden>✋</div>}
    </div>
  );
}
