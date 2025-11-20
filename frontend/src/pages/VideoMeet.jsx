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

  // ----------------------- INIT / JOIN ROOM -----------------------
  useEffect(() => {
    const paths = window.location.pathname.split("/");
    const id = paths[2] || "lobby"; // correct route /meet/:id
    setRoomId(id);

    socketRef.current = io(SIGNAL_SERVER, { transports: ["websocket"] });

    socketRef.current.on("connect", () => {
      const username = localStorage?.user
        ? JSON.parse(localStorage.user).name
        : "Guest";

      socketRef.current.emit("join-request", { room: id, username });
    });

    socketRef.current.on("joined", async (payload) => {
      setParticipants(payload.members || []);
      setIsHost(Boolean(payload.isHost));
      await startLocalMedia(payload.members || []);
      showToast("You joined the room");
    });

    socketRef.current.on("lobby-wait", () =>
      showToast("Waiting for host approval...")
    );

    socketRef.current.on("approved", async (payload) => {
      setParticipants(payload.members || []);
      await startLocalMedia(payload.members || []);
      showToast("Approved — you are in!");
    });

    socketRef.current.on("members", (m) => setParticipants(m || []));

    socketRef.current.on("user-joined", () => {
      showToast("A user joined");
      socketRef.current.emit("get-members", { room: id });
    });

    socketRef.current.on("signal", async ({ from, type, data }) => {
      if (type === "offer") await handleOffer(from, data);
      if (type === "answer") {
        const pc = peersRef.current[from];
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data));
      }
      if (type === "candidate") {
        const pc = peersRef.current[from];
        if (pc) try { await pc.addIceCandidate(data); } catch {}
      }
    });

    socketRef.current.on("raise-hand", ({ username }) => {
      showToast(`${username} raised hand`);
    });

    socketRef.current.on("user-left", ({ id }) => {
      const pc = peersRef.current[id];
      if (pc) pc.close();
      delete peersRef.current[id];
      setParticipants((prev) => prev.filter((p) => p.id !== id));
    });

    return () => cleanup();
  }, []);

  // ----------------------- LOCAL MEDIA -----------------------
  async function startLocalMedia(existing = []) {
    if (!localStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = stream;
        if (localRef.current) localRef.current.srcObject = stream;
      } catch {
        showToast("Camera/Mic permission denied");
        return;
      }
    }

    for (const m of existing) {
      if (m.id !== socketRef.current.id) {
        await createPeerAndOffer(m.id);
      }
    }
  }

  // ----------------------- WEBRTC HELPERS -----------------------
  async function createPeerAndOffer(remoteId) {
    if (peersRef.current[remoteId]) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peersRef.current[remoteId] = pc;

    localStreamRef.current.getTracks().forEach((track) =>
      pc.addTrack(track, localStreamRef.current)
    );

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

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socketRef.current.emit("signal", {
      to: remoteId,
      type: "offer",
      data: offer,
    });
  }

  async function handleOffer(from, offer) {
    let pc = peersRef.current[from];

    if (!pc) {
      pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      peersRef.current[from] = pc;

      localStreamRef.current.getTracks().forEach((t) =>
        pc.addTrack(t, localStreamRef.current)
      );

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

  // ----------------------- REMOTE STREAM TILE -----------------------
  function attachRemoteStream(id, stream) {
    const grid = document.getElementById("remote-videos");
    if (!grid) return;

    let tile = grid.querySelector(`[data-peer="${id}"]`);

    if (!tile) {
      tile = document.createElement("video");
      tile.autoplay = true;
      tile.playsInline = true;
      tile.className = "remoteVideoEl";
      tile.setAttribute("data-peer", id);
      grid.appendChild(tile);
    }

    tile.srcObject = stream;
  }

  // ----------------------- TOAST -----------------------
  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  // ----------------------- CONTROLS -----------------------
  const toggleMic = () => {
    const tr = localStreamRef.current.getAudioTracks();
    tr.forEach((t) => (t.enabled = !t.enabled));
    setMicOn(tr[0].enabled);
  };

  const toggleCam = () => {
    const tr = localStreamRef.current.getVideoTracks();
    tr.forEach((t) => (t.enabled = !t.enabled));
    setCamOn(tr[0].enabled);
  };

  const startScreenShare = async () => {
    try {
      const disp = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = disp.getVideoTracks()[0];

      for (const pc of Object.values(peersRef.current)) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) sender.replaceTrack(track);
      }

      localRef.current.srcObject = disp;
      setIsSharingScreen(true);

      track.onended = () => stopScreenShare();
    } catch {}
  };

  const stopScreenShare = () => {
    const cam = localStreamRef.current.getVideoTracks()[0];

    for (const pc of Object.values(peersRef.current)) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) sender.replaceTrack(cam);
    }

    localRef.current.srcObject = localStreamRef.current;
    setIsSharingScreen(false);
  };

  // ---------------- FIXED raiseHand() ----------------
  const raiseHand = () => {
    const username = localStorage.user
      ? JSON.parse(localStorage.user).name
      : "Guest";

    socketRef.current.emit("raise-hand", {
      room: roomId,
      username,
    });

    showToast("You raised your hand");
  };

  const endCall = () => {
    cleanup();
    window.location.href = "/";
  };

  // ----------------------- CLEANUP -----------------------
  function cleanup() {
    try {
      socketRef.current?.disconnect();
    } catch {}
    try {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    Object.values(peersRef.current).forEach((pc) => pc.close());
    peersRef.current = {};
  }

  // ----------------------- UI -----------------------
  return (
    <div className="video-container">
      <div className="topbar">
        <div className="roomLabel">
          Room: <span className="roomId">{roomId}</span>
        </div>
        <div className="statusBadges">
          {isHost && <div className="hostBadge">Host</div>}
          <div className="countBadge">{participants.length} users</div>
        </div>
      </div>

      <div className="videoStage">
        <div id="remote-videos" className="remoteGrid"></div>

        <div className="localFloating">
          <video
            ref={localRef}
            autoPlay
            muted
            playsInline
            className="localVideo"
          />
          <div className="localLabel">You</div>
        </div>
      </div>

      <CallControls
        micOn={micOn}
        camOn={camOn}
        isSharingScreen={isSharingScreen}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
        onStartScreenShare={startScreenShare}
        onStopScreenShare={stopScreenShare}
        onRaiseHand={raiseHand}
        onEndCall={endCall}
        isHost={isHost}
        participants={participants}
        onApproveParticipant={() => {}}
      />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
