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

  // --------------------- tiny ding ---------------------
  function playDing() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.02);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      setTimeout(() => { try { osc.stop(); ctx.close(); } catch {} }, 150);
    } catch {}
  }

  // --------------------- main effect ---------------------
  useEffect(() => {
    const id = window.location.pathname.replace("/", "") || "lobby";
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

    socketRef.current.on("lobby-wait", () => {
      showToast("Waiting for host approval...");
    });

    socketRef.current.on("approved", async (payload) => {
      setParticipants(payload.members || []);
      await startLocalMedia(payload.members || []);
      showToast("Approved — you are in!");
    });

    // members snapshot updates - preserve pending flags
    socketRef.current.on("members", (m) => {
      setParticipants((prev) => {
        const pendingMap = {};
        prev.forEach(p => { if (p.pending) pendingMap[p.id] = true; });
        const newMembers = (m || []).map(x => ({ ...x, pending: false }));
        return newMembers.map(n => ({ ...n, pending: pendingMap[n.id] || false }));
      });
    });

    // host will get this when someone requests join
    socketRef.current.on("lobby-request", ({ id: reqId, username }) => {
      setParticipants(prev => {
        const exists = prev.find(p => p.id === reqId);
        if (exists) {
          return prev.map(p => (p.id === reqId ? { ...p, pending: true } : p));
        }
        return [...prev, { id: reqId, username, pending: true }];
      });
      showToast(`${username || reqId} requested to join`);
    });

    socketRef.current.on("user-joined", ({ username }) => {
      playDing();
      showToast(`${username || "User"} joined`);
      socketRef.current.emit("get-members", { room: id });
    });

    // screen-share notifications (from peers)
    socketRef.current.on("screen-share", ({ from, sharing }) => {
      setParticipants(prev => prev.map(p => p.id === from ? { ...p, sharing } : p));
      if (sharing) showToast("Someone started screen sharing");
      else showToast("Screen share stopped");
    });

    // signaling
    socketRef.current.on("signal", async ({ from, type, data }) => {
      if (type === "offer") await handleOffer(from, data);
      else if (type === "answer") {
        const pc = peersRef.current[from];
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data));
      } else if (type === "candidate") {
        const pc = peersRef.current[from];
        if (pc) try { await pc.addIceCandidate(data); } catch {}
      }
    });

    socketRef.current.on("raise-hand", ({ from, username }) => {
      showToast(`${username || from} raised hand`);
      setParticipants(prev => prev.map(p => p.id === from ? { ...p, raised: true } : p));
      setTimeout(() => {
        setParticipants(prev => prev.map(p => p.id === from ? { ...p, raised: false } : p));
      }, 6000);
    });

    socketRef.current.on("user-left", ({ id: leftId }) => {
      const pc = peersRef.current[leftId];
      if (pc) {
        try { pc.close(); } catch {}
        delete peersRef.current[leftId];
      }
      setParticipants(prev => prev.filter(p => p.id !== leftId));
      const el = document.querySelector(`[data-peer="${leftId}"]`);
      if (el && el.parentNode) el.parentNode.remove();
    });

    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------- local media ---------------------
  async function startLocalMedia(existingMembers = []) {
    if (!localStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localRef.current) localRef.current.srcObject = stream;
      } catch (e) {
        showToast("Camera/Mic permission denied");
        return;
      }
    }

    // create offers to existing users
    for (const m of existingMembers) {
      if (m.id !== socketRef.current.id) {
        await createPeerAndOffer(m.id);
      }
    }
  }

  // --------------------- peers ---------------------
  async function createPeerAndOffer(remoteId) {
    if (peersRef.current[remoteId]) return;

    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    peersRef.current[remoteId] = pc;

    // add tracks
    localStreamRef.current?.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));

    pc.onicecandidate = (e) => {
      if (e.candidate) socketRef.current.emit("signal", { to: remoteId, type: "candidate", data: e.candidate });
    };

    pc.ontrack = (e) => attachRemoteStream(remoteId, e.streams[0]);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socketRef.current.emit("signal", { to: remoteId, type: "offer", data: offer });
  }

  async function handleOffer(from, offer) {
    let pc = peersRef.current[from];

    if (!pc) {
      pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      peersRef.current[from] = pc;
      localStreamRef.current?.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));
      pc.onicecandidate = (e) => { if (e.candidate) socketRef.current.emit("signal", { to: from, type: "candidate", data: e.candidate }); };
      pc.ontrack = (e) => attachRemoteStream(from, e.streams[0]);
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socketRef.current.emit("signal", { to: from, type: "answer", data: answer });
  }

  // --------------------- remote stream ---------------------
  function attachRemoteStream(peerId, stream) {
    setParticipants((prev) => {
      if (!prev.find((p) => p.id === peerId)) {
        return [...prev, { id: peerId, username: peerId }];
      }
      return prev;
    });

    const grid = document.getElementById("remote-videos");
    if (!grid) return;

    let tile = grid.querySelector(`[data-wrap="${peerId}"]`);
    if (!tile) {
      tile = document.createElement("div");
      tile.className = "participantTile";
      tile.setAttribute("data-wrap", peerId);

      const v = document.createElement("video");
      v.autoplay = true;
      v.playsInline = true;
      v.className = "remoteVideoEl";
      v.setAttribute("data-peer", peerId);

      const lbl = document.createElement("div");
      lbl.className = "tileLabel";
      lbl.innerText = peerId;

      const raised = document.createElement("div");
      raised.className = "raisedBadge";
      raised.innerText = "✋";
      raised.style.display = "none";

      tile.appendChild(v);
      tile.appendChild(lbl);
      tile.appendChild(raised);
      grid.appendChild(tile);
    }

    // if this incoming stream looks like a screen-share, add a class so CSS can make it large
    try {
      const vid = tile.querySelector("video");
      // basic heuristic: track label often contains "screen" for displayMedia
      const track = stream.getVideoTracks()[0];
      const label = track?.label || "";
      if (/(screen|display)/i.test(label)) {
        tile.classList.add("screenTile");
        // set a data attribute to help CSS/JS
        tile.setAttribute("data-screenshare", "true");
        // inform UI state so participants list updates
        setParticipants((prev) => prev.map(p => p.id === peerId ? { ...p, sharing: true } : p));
      } else {
        tile.classList.remove("screenTile");
        tile.removeAttribute("data-screenshare");
      }

      // attach stream
      try {
        vid.srcObject = stream;
      } catch {
        vid.src = URL.createObjectURL(stream);
      }
    } catch (err) {
      console.warn("attachRemoteStream error", err);
    }
  }

  // --------------------- toast ---------------------
  function showToast(msg, t = 3000) {
    setToast(msg);
    setTimeout(() => setToast(""), t);
  }

  // --------------------- controls ---------------------
  const toggleMic = () => {
    if (!localStreamRef.current) return;
    const tr = localStreamRef.current.getAudioTracks();
    if (!tr.length) return;
    tr.forEach((t) => (t.enabled = !t.enabled));
    setMicOn(tr[0].enabled);
    socketRef.current.emit("media-update", { room: roomId, mic: tr[0].enabled });
  };

  const toggleCam = () => {
    if (!localStreamRef.current) return;
    const tr = localStreamRef.current.getVideoTracks();
    if (!tr.length) return;
    tr.forEach((t) => (t.enabled = !t.enabled));
    setCamOn(tr[0].enabled);
    socketRef.current.emit("media-update", { room: roomId, cam: tr[0].enabled });
  };

  // startScreenShare toggles share/stop (keeps earlier behavior)
  const startScreenShare = async () => {
    if (!localStreamRef.current) { showToast("Local media not started"); return; }

    if (isSharingScreen) {
      // stop sharing: replace with camera track
      const camTrack = localStreamRef.current.getVideoTracks()[0];
      if (!camTrack) return;
      Object.values(peersRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
        if (sender) sender.replaceTrack(camTrack);
      });
      if (localRef.current) localRef.current.srcObject = localStreamRef.current;
      setIsSharingScreen(false);
      // notify others
      if (socketRef.current?.connected) socketRef.current.emit("screen-share", { room: roomId, from: socketRef.current.id, sharing: false });
      return;
    }

    try {
      const disp = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = disp.getVideoTracks()[0];
      if (!track) return;

      Object.values(peersRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
        if (sender) sender.replaceTrack(track);
      });

      if (localRef.current) localRef.current.srcObject = disp;
      setIsSharingScreen(true);

      // notify others that you started sharing
      if (socketRef.current?.connected) socketRef.current.emit("screen-share", { room: roomId, from: socketRef.current.id, sharing: true });

      track.onended = () => {
        const camTrack = localStreamRef.current?.getVideoTracks()[0];
        Object.values(peersRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
          if (sender && camTrack) sender.replaceTrack(camTrack);
        });
        if (localRef.current && localStreamRef.current) localRef.current.srcObject = localStreamRef.current;
        setIsSharingScreen(false);
        // notify others that you stopped
        if (socketRef.current?.connected) socketRef.current.emit("screen-share", { room: roomId, from: socketRef.current.id, sharing: false });
      };
    } catch (e) {
      console.log("Screen share cancelled or failed", e);
    }
  };

  const endCall = () => {
    cleanup();
    window.location.href = "/";
  };

  const raiseHand = () => {
    socketRef.current.emit("raise-hand", { room: roomId, raised: true });
    showToast("You raised your hand");
  };

  const approveParticipant = (userId) => {
    socketRef.current.emit("approve-join", { room: roomId, userId });
    setParticipants(prev => prev.map(p => p.id === userId ? { ...p, pending: false } : p));
  };

  // --------------------- cleanup ---------------------
  function cleanup() {
    try { socketRef.current?.disconnect(); } catch {}
    try { localStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    Object.values(peersRef.current).forEach((pc) => { try { pc.close(); } catch {} });
    peersRef.current = {};
  }

  // --------------------- render ---------------------
  return (
    <div className="video-container">
      <div className="topbar">
        <div className="roomLabel">
          Gup-Shap — Room: <span className="roomId">{roomId}</span>
        </div>

        <div className="statusBadges">
          {isHost && <div className="hostBadge">Host</div>}
          <div className="countBadge">{participants.length} participants</div>
        </div>
      </div>

      <div className="videoStage">
        <div id="remote-videos" className="remoteGrid"></div>

        <div className={`localFloating ${isSharingScreen ? "sharing" : ""}`}>
          <video ref={localRef} autoPlay muted playsInline className="localVideo" />
          <div className="localLabel">
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
        onStartScreenShare={startScreenShare}  // toggle-style handler (start/stop)
        onEndCall={endCall}
        onRaiseHand={raiseHand}
        isHost={isHost}
        participants={participants}
        onApproveParticipant={approveParticipant}
      />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
