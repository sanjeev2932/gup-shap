// frontend/src/pages/VideoMeet.jsx
import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import CallControls from "../components/CallControls";
import "../styles/videoComponent.css";
import "../styles/videoMeetOverrides.css";

const SIGNAL_SERVER = "https://gup-shapbackend.onrender.com";

export default function VideoMeet() {
  const localRef = useRef();
  const peersRef = useRef({});
  const socketRef = useRef();
  const localStreamRef = useRef(null);

  const [roomId, setRoomId] = useState("");
  const [participants, setParticipants] = useState([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [toast, setToast] = useState("");

  // ---------------- GET CORRECT ROOM ID ----------------
  useEffect(() => {
    const paths = window.location.pathname.split("/");
    const id = paths[2] || "lobby";   // ✅ correct: /meet/:roomId
    setRoomId(id);

    socketRef.current = io(SIGNAL_SERVER, { transports: ["websocket"] });

    socketRef.current.on("connect", () => {
      const username = localStorage?.user ? JSON.parse(localStorage.user).name : "Guest";
      socketRef.current.emit("join-request", { room: id, username });
    });

    socketRef.current.on("joined", async (payload) => {
      setParticipants(payload.members || []);
      setIsHost(Boolean(payload.isHost));
      await startLocalMedia(payload.members || []);
      showToast("You joined the room");
    });

    socketRef.current.on("lobby-wait", () => showToast("Waiting for host approval..."));

    socketRef.current.on("approved", async (payload) => {
      setParticipants(payload.members || []);
      await startLocalMedia(payload.members || []);
      showToast("Approved — you are in!");
    });

    // ... REST OF YOUR CODE BELOW (UNCHANGED) ...
  }, []);
