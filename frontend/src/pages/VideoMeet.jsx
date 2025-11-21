import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import CallControls from "../components/CallControls";
import VideoTile from "../components/VideoTile";
import "../styles/videoComponent.css";
import "../styles/videoMeetCute.css";
import server from "../environment";

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

  // Approval logic
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [approved, setApproved] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]); // {userId, username}

  function showToast(msg, t = 2500) {
    setToast(msg);
    setTimeout(() => setToast(""), t);
  }

  async function startLocalMedia() {
    // Always fetch media on join for reliability
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localRef.current) localRef.current.srcObject = stream;
      setMicOn(Boolean(stream.getAudioTracks()[0]?.enabled));
      setCamOn(Boolean(stream.getVideoTracks()[0]?.enabled));
    } catch (err) {
      if (err.name === "NotAllowedError") {
        showToast("Camera/Microphone permission denied");
      } else {
        showToast("Unable to access camera/microphone");
      }
      throw err;
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

    // Host: listen for join requests
    socketRef.current.on("join-pending", ({ userId, username }) => {
      setPendingRequests((reqs) => [...reqs, { userId, username }]);
      setApprovalRequired(true);
    });

    // Guest: waiting for approval
    socketRef.current.on("waiting-approval", ({ room }) => {
      setApprovalRequired(true);
      setApproved(false);
      showToast("Waiting for Host Approval...");
    });

    // Guest: was approved by host
    socketRef.current.on("approved", (payload) => {
      setApprovalRequired(false);
      setApproved(true);
      setParticipants(payload.members || []);
      showToast("You have been approved! Joining room...");
      for (const m of payload.members || []) {
        if (m.id !== socketRef.current.id && !peersRef.current[m.id]) {
          createPeerAndOffer(m.id);
        }
      }
    });

    // Guest: rejected by host
    socketRef.current.on("rejected", ({ room }) => {
      setApprovalRequired(false);
      setApproved(false);
      showToast("You were not approved.");
      setTimeout(() => window.location.href = "/", 2200);
    });

    socketRef.current.on("joined", async (payload) => {
      setParticipants(payload.members || []);
      if (payload.isHost) {
        setApproved(true);
        setApprovalRequired(false);
        showToast("You joined as Host");
      } else if (payload.approved) {
        setApproved(true);
        setApprovalRequired(false);
        showToast("You joined the room");
      }
      for (const m of payload.members || []) {
        if (m.id !== socketRef.current.id && !peersRef.current[m.id]) {
          await createPeerAndOffer(m.id);
        }
      }
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

  // Tiles logic - only users with streams (video) are shown
  const remoteIds = Object.keys(streams);
  const tiles = [
    ...remoteIds.map((id) => ({
      id,
      stream: streams[id],
      username: participants.find((p) => p.id === id)?.username || id,
    })),
    { id: "local", stream: localStreamRef.current, username: "You" },
  ].filter(t => t.stream); // Only tiles with video get rendered

  // Big tile for only one participant (video stream); equal size for multiple 
  const isSingle = tiles.length === 1;

  useEffect(() => {
    setScreenActive(Boolean(screenStreamRef.current));
  }, [screenStreamRef.current]);

  const speakingId = getSpeakingId(participants);

  // Host UI: approve/reject popups
  function handleApprove(userId) {
    socketRef.current.emit("approve-join", { room: roomId, userId });
    setPendingRequests((reqs) => reqs.filter((r) => r.userId !== userId));
    if (pendingRequests.length === 1) setApprovalRequired(false);
  }
  function handleReject(userId) {
    socketRef.current.emit("reject-join", { room: roomId, userId });
    setPendingRequests((reqs) => reqs.filter((r) => r.userId !== userId));
    if (pendingRequests.length === 1) setApprovalRequired(false);
  }

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

  // Approval handling: guest view
  if (approvalRequired && !approved && pendingRequests.length === 0) {
    return (
      <div className="meet-cute-bg meet-center">
        <div className="waiting-approval-popup">
          <div style={{ fontSize: 20, marginBottom: 30 }}>
            Waiting for Host Approval...
          </div>
          <div className="spinner" />
        </div>
        {toast && <div style={{ marginTop: 20, color: "red" }}>{toast}</div>}
      </div>
    );
  }

  // Host: show requests to approve/reject
  if (approvalRequired && pendingRequests.length > 0) {
    return (
      <div className="meet-cute-bg meet-center">
        <div className="approval-popup">
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 18 }}>
            Approve guests to join your call:
          </div>
          {pendingRequests.map(req => (
            <div key={req.userId} style={{
              background: "#fcf8ff",
              padding: "18px 22px",
              borderRadius: "18px",
              marginBottom: "18px",
              boxShadow: "0 2px 14px 0px #eecdf3"
            }}>
              <span style={{ fontWeight: 600 }}>{req.username || req.userId}</span>
              <button className="meet-cute-btn" style={{ marginLeft: 20 }} onClick={() => handleApprove(req.userId)}>
                Approve
              </button>
              <button style={{ marginLeft: 6, background: "#ffebee", color: "#db2462", borderRadius: "13px", padding: "8px 16px", border: "none", fontWeight: 600, cursor: "pointer" }}
                onClick={() => handleReject(req.userId)}>
                Reject
              </button>
            </div>
          ))}
        </div>
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
      <div className={`videoStageCute ${isSingle ? "singleStage" : ""}`}>
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
