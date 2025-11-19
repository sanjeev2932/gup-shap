import React, { useEffect, useRef, useState } from "react";
import "../styles/videoComponent.css";
import "../styles/videoMeetOverrides.css";  // UI FIX

const SIGNALING_URL = "wss://gup-shapbackend.onrender.com";

const VideoMeet = () => {
  const localRef = useRef(null);
  const remoteRef = useRef(null);
  const pcRef = useRef(null);
  const wsRef = useRef(null);
  const [roomId, setRoomId] = useState("");

  useEffect(() => {
    const id = window.location.pathname.replace("/", "") || "lobby";
    setRoomId(id);

    wsRef.current = new WebSocket(SIGNALING_URL);

    wsRef.current.onopen = () => {
      wsRef.current.send(JSON.stringify({ type: "join", room: id }));
    };

    wsRef.current.onmessage = async (msg) => {
      const data = JSON.parse(msg.data);
      if (!pcRef.current) return;

      if (data.type === "offer") {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        wsRef.current.send(JSON.stringify({ type: "answer", answer, room: id }));
      } 
      else if (data.type === "answer") {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      } 
      else if (data.type === "candidate") {
        try {
          await pcRef.current.addIceCandidate(data.candidate);
        } catch (e) {}
      }
    };

    pcRef.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pcRef.current.onicecandidate = (e) => {
      if (e.candidate) {
        wsRef.current.send(JSON.stringify({ type: "candidate", candidate: e.candidate, room: id }));
      }
    };

    pcRef.current.ontrack = (e) => {
      remoteRef.current.srcObject = e.streams[0];
    };

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localRef.current.srcObject = stream;
        stream.getTracks().forEach((track) => pcRef.current.addTrack(track, stream));

        pcRef.current.createOffer().then((offer) => {
          pcRef.current.setLocalDescription(offer);
          wsRef.current.send(JSON.stringify({ type: "offer", offer, room: id }));
        });
      })
      .catch((e) => console.error("getUserMedia error:", e));

    return () => {
      try { wsRef.current.close(); } catch (e) {}
      try { pcRef.current.close(); } catch (e) {}
    };
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#08101f", paddingTop: "20px" }}>
      <h2 style={{ textAlign: "center", color: "#fff", marginBottom: "20px" }}>
        Room: {roomId}
      </h2>

      <div className="video-grid">
        <div className="video-frame">
          <video ref={localRef} autoPlay muted playsInline />
        </div>

        <div className="video-frame">
          <video ref={remoteRef} autoPlay playsInline />
        </div>
      </div>
    </div>
  );
};

export default VideoMeet;
