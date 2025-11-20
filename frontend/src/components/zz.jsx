// frontend/src/components/VideoTile.jsx
import React, { useEffect, useRef } from "react";

export default function VideoTile({
  id,
  username,
  stream,
  active = false,
  sharing = false,
  raised = false,
}) {
  const videoRef = useRef();

  useEffect(() => {
    if (!videoRef.current) return;
    if (stream) {
      try {
        videoRef.current.srcObject = stream;
      } catch {
        videoRef.current.src = URL.createObjectURL(stream);
      }
    } else {
      try {
        videoRef.current.srcObject = null;
      } catch {}
      videoRef.current.removeAttribute("src");
    }
  }, [stream]);

  return (
    <div
      className={`participantTile ${sharing ? "screenTile" : ""} ${
        active ? "active" : ""
      }`}
      data-peer={id}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        className="remoteVideoEl"
      />
      <div className="tileLabel">{username}</div>
      {raised && <div className="raisedBadge">✋</div>}
    </div>
  );
}
