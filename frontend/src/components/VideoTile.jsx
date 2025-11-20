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
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = stream || null;
      } catch (err) {
        videoRef.current.src = "";
      }
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

      <div className="tileLabel">{username || id}</div>

      {raised && <div className="raisedBadge">✋</div>}
    </div>
  );
}
