import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import CallControls from "../components/CallControls";
import VideoTile from "../components/VideoTile";
import "../styles/videoComponent.css";
import "../styles/videoMeetCute.css";
import server from "../environment";

// Dummy speaking logic (replace with real volume detection for production)
const getSpeakingId = (participants) => participants[0]?.id || "";

export default function VideoMeet() {
  const localRef = useRef();
  const peersRef = useRef({});
  const socketRef = useRef();
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  const [roomId, setRoomId] = useState("");
  const [participants, setParticipants] = useState([]);
  const [streams, setStreams] = useState({});
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [toast, setToast] = useState("");
  const [ready, setReady] = useState(false);
  const [screenActive, setScreenActive] = useState(false);

  function showToast(msg, t = 2500) {
    setToast(msg);
    setTimeout(() => setToast(""), t);
  }

  async function startLocalMedia() {
    if (!localStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localRef.current) localRef.current.srcObject = stream;
        setMicOn(Boolean(stream.getAudioTracks()[0]?.enabled));
        setCamOn(Boolean(stream.getVideoTracks()[0]?.enabled));
      } catch (err) {
        console.warn("getUserMedia error:", err);
        if (err.name === "NotAllowedError") {
          showToast("Camera/Microphone permission denied");
        } else {
          showToast("Unable to access camera/microphone");
        }
        throw err;
      }
    }
  }

  async function createPeerAndOffer(remoteId) {
    const pc = new window.RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peersRef.current[remoteId] = pc;

    localStreamRef.current?.getTracks().forEach((track) => {
      try {
        pc.addTrack(track, localStreamRef.current);
      } catch (err) {
        console.warn("pc.addTrack failed", err);
      }
    });

    pc.ontrack = (e) => attachRemoteStream(remoteId, e.streams[0]);
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current?.emit("signal", {
          to: remoteId,
          type: "candidate",
          data: e.candidate,
        });
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.emit("signal", {
        to: remoteId,
        type: "offer",
        data: offer,
      });
    } catch (err) {
      console.warn("createPeerAndOffer error", err);
    }
  }

  function attachRemoteStream(peerId, stream) {
    setStreams((prev) => ({ ...prev, [peerId]: stream }));
    setParticipants((prev) => {
      if (!prev.find((p) => p.id === peerId))
        return [...prev, { id: peerId }];
      return prev;
    });
  }

  function cleanup() {
    try { socketRef.current?.disconnect(); } catch {}
    try { screenStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    try { localStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    for (const pc of Object.values(peersRef.current)) {
      try { pc.close(); } catch {}
    }
    peersRef.current = {};
    localStreamRef.current = null;
    screenStreamRef.current = null;
    setStreams({});
    setParticipants([]);
  }

  async function handleJoin() {
    try {
      await startLocalMedia();
      setReady(true);
    } catch (e) {
      console.warn("handleJoin error", e);
    }
  }

  useEffect(() => {
    if (!ready) return;
    const room = window.location.pathname.split("/")[2] || "lobby";
    setRoomId(room);

    socketRef.current = io(server, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      secure: true,
      autoConnect: true,
    });

    socketRef.current.on("connect", () => {
      const username = localStorage.user
        ? JSON.parse(localStorage.user).name
        : "Guest";
      socketRef.current.emit("join-request", { room, username });
    });

    socketRef.current.on("joined", async (payload) => {
      setParticipants(payload.members || []);
      for (const m of payload.members || []) {
        if (m.id !== socketRef.current.id && !peersRef.current[m.id]) {
          await createPeerAndOffer(m.id);
        }
      }
      showToast("You joined the room");
    });

    socketRef.current.on("members", (list) => {
      setParticipants(list || []);
    });

    socketRef.current.on("user-left", ({ id }) => {
      const pc = peersRef.current[id];
      if (pc) {
        try { pc.close(); } catch {}
      }
      delete peersRef.current[id];
      setStreams((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      setParticipants((cur) => cur.filter((p) => p.id !== id));
    });

    return () => cleanup();
  }, [ready]);

  // Floating local video tile logic
  const tiles = Object.keys(streams).length === 0
    ? [{ id: "local", stream: localStreamRef.current, username: "You" }]
    : [
        ...Object.keys(streams).map((id) => ({
          id,
          stream: streams[id],
          username:
            participants.find((p) => p.id === id)?.username || id,
        })),
        { id: "local", stream: localStreamRef.current, username: "You" },
      ];

  useEffect(() => {
    setScreenActive(Boolean(screenStreamRef.current));
  }, [screenStreamRef.current]);

  const speakingId = getSpeakingId(participants); // replace with real detection
  const single = tiles.length === 1;

  // PRE-JOIN
  if (!ready) {
    return (
      <div className="meet-cute-bg meet-center">
        <button className="meet-cute-btn" onClick={handleJoin}>
          Join Call
        </button>
        {toast && <div style={{ marginTop: 20, color: "red" }}>{toast}</div>}
      </div>
    );
  }

  return (
    <div className="meet-cute-bg meet-page-cute">
      <div className="topbar">
        <div className="roomLabel">
          Gup-Shap — Room: <span className="roomId">{roomId}</span>
        </div>
        <div className="countBadge">
          {participants.length} participants
        </div>
      </div>
      <div className={`videoStageCute ${single ? "singleStage" : ""}`}>
        <div className={`videoGridCute${screenActive ? " presentingStage" : ""}`}>
          {tiles.map((tile) => (
            <VideoTile
              key={tile.id}
              id={tile.id}
              username={tile.username}
              stream={tile.stream}
              active={tile.id === speakingId}
              sharing={screenActive && tile.id === "local"}
              pinned={false}
            />
          ))}
        </div>
      </div>
      <CallControls
        micOn={micOn}
        camOn={camOn}
        onToggleMic={() => {}}
        onToggleCam={() => {}}
        onEndCall={() => window.location.href = "/"}
        onStartScreenShare={() => {}}
        onStopScreenShare={() => {}}
      />
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
