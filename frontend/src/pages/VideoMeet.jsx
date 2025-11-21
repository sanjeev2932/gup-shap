import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import CallControls from "../components/CallControls";
import VideoTile from "../components/VideoTile";
import "../styles/videoComponent.css";
import "../styles/videoMeetCute.css";         // NEW custom styles
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

  // ----- Socket & join logic unchanged -----

  function showToast(msg, t = 2500) {
    setToast(msg);
    setTimeout(() => setToast(""), t);
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

    // ...rest unchanged (for brevity)

    return () => cleanup();
  }, [ready]);

  // ...rest unchanged (media, socket handlers etc.)

  // Floating local video tile logic:
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

  // Detect "presenting" (screen share) state — for demo, toggle when stream exists
  useEffect(() => {
    setScreenActive(Boolean(screenStreamRef.current));
  }, [screenStreamRef.current]);

  // Dummy: mark local as speaking (replace with real logic)
  const speakingId = getSpeakingId(participants);

  // If only one participant (local), center & enlarge
  const single = tiles.length === 1;

  // ----- Render page -----

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
              // Visual props:
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
