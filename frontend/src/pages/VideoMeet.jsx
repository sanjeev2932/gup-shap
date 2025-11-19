// frontend/src/pages/VideoMeet.jsx
import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import CallControls from "../components/CallControls";
import "../styles/videoComponent.css";
import "../styles/videoMeetOverrides.css";

// 🔥 ONLINE AUDIO (no assets, no errors)
const RING_URL = "https://cdn.pixabay.com/audio/2022/03/15/audio_67e6c79fd5.mp3";

const SIGNAL_SERVER = "https://gup-shapbackend.onrender.com";

export default function VideoMeet() {
  const localVideoRef = useRef(null);
  const peerConnections = useRef({});
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const videoRefs = useRef({});

  const [roomId, setRoomId] = useState("");
  const [participants, setParticipants] = useState([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const ringAudioRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isWaitingLobby, setIsWaitingLobby] = useState(false);
  const [isHost, setIsHost] = useState(false);

  // ------------------------------
  // INITIAL SETUP
  // ------------------------------
  useEffect(() => {
    const id = (window.location.pathname.replace("/", "") || "lobby");
    setRoomId(id);

    socketRef.current = io(SIGNAL_SERVER, { transports: ["websocket"] });

    socketRef.current.on("connect", () => {
      const username =
        localStorage?.user ? JSON.parse(localStorage.user).name : "Guest";
      socketRef.current.emit("join-request", { room: id, username });
    });

    socketRef.current.on("lobby-wait", ({ hostId }) => {
      setIsWaitingLobby(true);
      setIsHost(false);
    });

    socketRef.current.on("joined", async (payload) => {
      setIsWaitingLobby(false);
      setIsHost(Boolean(payload.isHost));
      setParticipants(payload.members);
      await startLocalMedia();
      setIsConnected(true);
    });

    socketRef.current.on("approved", async (payload) => {
      setIsWaitingLobby(false);
      setParticipants(payload.members);
      await startLocalMedia();
      setIsConnected(true);
    });

    socketRef.current.on("members", (members) => {
      setParticipants(members || []);
    });

    socketRef.current.on("user-joined", ({ id: newId }) => {
      playRing();
      socketRef.current.emit("get-members", { room: id });
    });

    socketRef.current.on("signal", async ({ from, type, data }) => {
      if (type === "offer") await handleOffer(from, data);
      if (type === "answer") {
        const pc = peerConnections.current[from];
        if (pc) pc.setRemoteDescription(new RTCSessionDescription(data));
      }
      if (type === "candidate") {
        const pc = peerConnections.current[from];
        if (pc) {
          try {
            await pc.addIceCandidate(data);
          } catch {}
        }
      }
    });

    socketRef.current.on("user-left", ({ id: leftId }) => {
      setParticipants((prev) => prev.filter((p) => p.id !== leftId));

      const pc = peerConnections.current[leftId];
      if (pc) {
        try {
          pc.close();
        } catch {}
        delete peerConnections.current[leftId];
      }

      const el = document.querySelector(`[data-peer="${leftId}"]`);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });

    return () => cleanup();
  }, []);

  // ------------------------------
  // START LOCAL CAMERA
  // ------------------------------
  async function startLocalMedia() {
    if (!localStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: camOn,
          audio: micOn,
        });
        localStreamRef.current = stream;
        localVideoRef.current.srcObject = stream;
      } catch (e) {
        console.error("Media error:", e);
        return;
      }
    }

    for (const member of participants) {
      if (member.id === socketRef.current.id) continue;
      await createPeerAndOffer(member.id);
    }
  }

  // ------------------------------
  // OFFER CREATION
  // ------------------------------
  async function createPeerAndOffer(remoteId) {
    if (peerConnections.current[remoteId]) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) =>
        pc.addTrack(t, localStreamRef.current)
      );
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current.emit("signal", {
          to: remoteId,
          type: "candidate",
          data: e.candidate,
        });
      }
    };

    pc.ontrack = (e) => attachRemoteStream(remoteId, e.streams[0]);

    peerConnections.current[remoteId] = pc;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socketRef.current.emit("signal", {
      to: remoteId,
      type: "offer",
      data: offer,
    });
  }

  // ------------------------------
  // HANDLE RECEIVED OFFER
  // ------------------------------
  async function handleOffer(from, offer) {
    let pc = peerConnections.current[from];

    if (!pc) {
      pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      peerConnections.current[from] = pc;

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) =>
          pc.addTrack(t, localStreamRef.current)
        );
      }

      pc.onicecandidate = (e) => {
        if (e.candidate)
          socketRef.current.emit("signal", {
            to: from,
            type: "candidate",
            data: e.candidate,
          });
      };

      pc.ontrack = (e) => attachRemoteStream(from, e.streams[0]);
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socketRef.current.emit("signal", {
      to: from,
      type: "answer",
      data: answer,
    });
  }

  // ------------------------------
  // ADD REMOTE STREAM
  // ------------------------------
  function attachRemoteStream(peerId, stream) {
    setParticipants((prev) => {
      if (!prev.find((p) => p.id === peerId))
        return [...prev, { id: peerId, username: peerId }];
      return prev;
    });

    let el = document.querySelector(`[data-peer="${peerId}"]`);

    if (!el) {
      const container = document.getElementById("remote-videos");
      const wrap = document.createElement("div");
      wrap.className = "remote-video-wrap";

      el = document.createElement("video");
      el.setAttribute("data-peer", peerId);
      el.autoplay = true;
      el.playsInline = true;

      const label = document.createElement("div");
      label.className = "video-username";
      label.innerText = peerId;

      wrap.appendChild(el);
      wrap.appendChild(label);
      container.appendChild(wrap);
    }

    el.srcObject = stream;
    videoRefs.current[peerId] = el;
  }

  // ------------------------------
  // 🔥 ONLINE RING SOUND
  // ------------------------------
  function playRing() {
    if (!ringAudioRef.current) {
      ringAudioRef.current = new Audio(RING_URL);
      ringAudioRef.current.volume = 0.65;
    }
    ringAudioRef.current.play().catch(() => {});
  }

  // ------------------------------
  // TOGGLES
  // ------------------------------
  const toggleMic = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setMicOn(localStreamRef.current.getAudioTracks()[0].enabled);
  };

  const toggleCam = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setCamOn(localStreamRef.current.getVideoTracks()[0].enabled);
  };

  // ------------------------------
  // CLEANUP
  // ------------------------------
  function cleanup() {
    try {
      socketRef.current.disconnect();
    } catch {}

    try {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}

    Object.values(peerConnections.current).forEach((pc) => {
      try {
        pc.close();
      } catch {}
    });

    peerConnections.current = {};
  }

  // ------------------------------
  // UI
  // ------------------------------
  return (
    <div className="meet-container">
      <div className="meet-topbar">
        <h2>
          Gup-Shap — Room: <span className="room-id">{roomId}</span>
        </h2>

        <div className="room-actions">
          {isWaitingLobby && <div className="lobby-note">Waiting for host approval...</div>}
          {isHost && <div className="host-badge">Host</div>}
        </div>
      </div>

      <div className="video-stage">
        <div id="remote-videos" className="remote-grid"></div>

        <div className="local-floating">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="local-video"
          />
          <div className="local-label">
            {localStorage?.user ? JSON.parse(localStorage.user).name : "You"}
          </div>
        </div>
      </div>

      <CallControls
        micOn={micOn}
        camOn={camOn}
        isSharingScreen={isSharingScreen}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
        onStartScreenShare={() => console.log("todo")}
        onEndCall={() => (window.location.href = "/")}
        onRaiseHand={() => socketRef.current.emit("raise-hand", { room: roomId })}
        isHost={isHost}
        participants={participants}
        onApproveParticipant={(userId) =>
          socketRef.current.emit("approve-join", { room: roomId, userId })
        }
      />
    </div>
  );
}
