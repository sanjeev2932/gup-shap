import React, { useEffect, useRef, useState } from "react";
import "../styles/videoComponent.css";

const SIGNALING_URL = "wss://gup-shapbackend.onrender.com";

const VideoMeet = () => {
  const myVideo = useRef(null);
  const remoteVideo = useRef(null);
  const socket = useRef(null);
  const peer = useRef(null);

  const [room, setRoom] = useState("");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const roomId = window.location.pathname.replace("/", "");
    setRoom(roomId);

    socket.current = new WebSocket(SIGNALING_URL);

    socket.current.onopen = () => {
      socket.current.send(JSON.stringify({ type: "join", room: roomId }));
      setConnected(true);
    };

    socket.current.onmessage = async (msg) => {
      const data = JSON.parse(msg.data);

      if (data.type === "offer") {
        await peer.current.setRemoteDescription(data.offer);
        const answer = await peer.current.createAnswer();
        await peer.current.setLocalDescription(answer);

        socket.current.send(JSON.stringify({ type: "answer", answer, room }));
      }

      if (data.type === "answer") {
        await peer.current.setRemoteDescription(data.answer);
      }

      if (data.type === "candidate") {
        try {
          await peer.current.addIceCandidate(data.candidate);
        } catch (e) {}
      }
    };

    peer.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peer.current.onicecandidate = (e) => {
      if (e.candidate)
        socket.current.send(
          JSON.stringify({ type: "candidate", candidate: e.candidate, room })
        );
    };

    peer.current.ontrack = (e) => {
      remoteVideo.current.srcObject = e.streams[0];
    };

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        myVideo.current.srcObject = stream;
        stream.getTracks().forEach((track) => {
          peer.current.addTrack(track, stream);
        });

        peer.current.createOffer().then((offer) => {
          peer.current.setLocalDescription(offer);
          socket.current.send(
            JSON.stringify({ type: "offer", offer, room: roomId })
          );
        });
      });

    return () => socket.current.close();
  }, []);

  return (
    <div className="meet-container">
      <h2>Room: {room}</h2>

      {!connected && <p className="status">Connecting to server...</p>}

      <div className="video-box">
        <video ref={myVideo} autoPlay muted />
        <video ref={remoteVideo} autoPlay />
      </div>
    </div>
  );
};

export default VideoMeet;
