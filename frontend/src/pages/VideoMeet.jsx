// frontend/src/pages/VideoMeet.jsx
import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import CallControls from "../components/CallControls";
import "../styles/videoComponent.css";
import "../styles/videoMeetOverrides.css";

const SIGNAL_SERVER = "https://gup-shapbackend.onrender.com";

/* ----------------------------------------------------
   ACTIVE SPEAKER ANALYSER
---------------------------------------------------- */
function createAudioAnalyser(stream, peerId) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = ctx.createAnalyser();
    const source = ctx.createMediaStreamSource(stream);

    analyser.fftSize = 256;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    source.connect(analyser);

    function detect() {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

      const tile = document.querySelector(`[data-wrap="${peerId}"]`);
      if (tile) {
        if (avg > 55) tile.classList.add("active");
        else tile.classList.remove("active");
      }

      requestAnimationFrame(detect);
    }

    detect();
  } catch (err) {
    console.warn("Audio analyser failed:", err);
  }
}

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

  const audioCtxRef = useRef(null);

  /* ----------------------------------------------------
     SMALL "DING" JOIN SOUND
  ---------------------------------------------------- */
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

      setTimeout(() => {
        try {
          osc.stop();
          ctx.close();
        } catch {}
      }, 150);
    } catch {}
  }

  /* ----------------------------------------------------
     MAIN EFFECT
  ---------------------------------------------------- */
  useEffect(() => {
    const id = window.location.pathname.replace("/", "") || "lobby";
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

    socketRef.current.on("lobby-wait", () => {
      showToast("Waiting for host approval...");
    });

    socketRef.current.on("approved", async (payload) => {
      setParticipants(payload.members || []);
      await startLocalMedia(payload.members || []);
      showToast("Approved — you are in!");
    });

    socketRef.current.on("members", (m) => {
      setParticipants(m || []);
    });

    // 🔔 Ding on join
    socketRef.current.on("user-joined", ({ username }) => {
      playDing();
      showToast(`${username || "User"} joined`);
      socketRef.current.emit("get-members", { room: id });
    });

    /* ------------ SIGNALS ------------ */
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

    /* ------------ RAISED HAND ------------ */
    socketRef.current.on("raise-hand", ({ from, username }) => {
      showToast(`${username || from} raised hand`);

      setParticipants((prev) =>
        prev.map((p) =>
          p.id === from ? { ...p, raised: true } : p
        )
      );

      // 🔥 VISUAL RAISED HAND POP BADGE
      const tile = document.querySelector(`[data-wrap="${from}"]`);
      if (tile) {
        const badge = tile.querySelector(".raisedBadge");
        if (badge) {
          badge.style.display = "block";
          setTimeout(() => {
            badge.style.display = "none";
          }, 6000);
        }
      }

      // remove raised-hand state
      setTimeout(() => {
        setParticipants((prev) =>
          prev.map((p) =>
            p.id === from ? { ...p, raised: false } : p
          )
        );
      }, 6000);
    });

    /* ------------ USER LEFT ------------ */
    socketRef.current.on("user-left", ({ id: leftId }) => {
      const pc = peersRef.current[leftId];
      if (pc) {
        try { pc.close(); } catch {}
        delete peersRef.current[leftId];
      }

      setParticipants((prev) => prev.filter((p) => p.id !== leftId));

      const el = document.querySelector(`[data-peer="${leftId}"]`);
      if (el && el.parentNode) el.parentNode.remove();
    });

    return () => cleanup();
  }, []);

  /* ----------------------------------------------------
     LOCAL MEDIA
  ---------------------------------------------------- */
  async function startLocalMedia(existingMembers = []) {
    if (!localStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: camOn,
          audio: micOn,
        });
        localStreamRef.current = stream;
        if (localRef.current) localRef.current.srcObject = stream;

        // 🔥 Local active speaker detection
        createAudioAnalyser(stream, socketRef.current.id);

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

  /* ----------------------------------------------------
     PEER CREATION
  ---------------------------------------------------- */
  async function createPeerAndOffer(remoteId) {
    if (peersRef.current[remoteId]) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peersRef.current[remoteId] = pc;

    localStreamRef.current?.getTracks().forEach((track) =>
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

      localStreamRef.current?.getTracks().forEach((track) =>
        pc.addTrack(track, localStreamRef.current)
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

  /* ----------------------------------------------------
     REMOTE STREAM
  ---------------------------------------------------- */
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

    const vid = tile.querySelector("video");
    try {
      vid.srcObject = stream;
    } catch {
      vid.src = URL.createObjectURL(stream);
    }

    /* 🔥 Enable active speaker detection for REMOTE users */
    createAudioAnalyser(stream, peerId);
  }

  /* ----------------------------------------------------
     TOAST
  ---------------------------------------------------- */
  function showToast(msg, t = 3000) {
    setToast(msg);
    setTimeout(() => setToast(""), t);
  }

  /* ----------------------------------------------------
     CONTROLS
  ---------------------------------------------------- */
  const toggleMic = () => {
    if (!localStreamRef.current) return;
    const tr = localStreamRef.current.getAudioTracks();
    if (!tr.length) return;

    tr.forEach((t) => (t.enabled = !t.enabled));
    setMicOn(tr[0].enabled);
  };

  const toggleCam = () => {
    if (!localStreamRef.current) return;
    const tr = localStreamRef.current.getVideoTracks();
    if (!tr.length) return;

    tr.forEach((t) => (t.enabled = !t.enabled));
    setCamOn(tr[0].enabled);
  };

  const startScreenShare = async () => {
    try {
      const disp = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = disp.getVideoTracks()[0];

      Object.values(peersRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
        if (sender) sender.replaceTrack(track);
      });

      localRef.current.srcObject = disp;
      setIsSharingScreen(true);

      track.onended = () => {
        if (localStreamRef.current) {
          localRef.current.srcObject = localStreamRef.current;

          Object.values(peersRef.current).forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
            if (sender)
              sender.replaceTrack(localStreamRef.current.getVideoTracks()[0]);
          });
        }
        setIsSharingScreen(false);
      };
    } catch (e) {}
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
  };

  /* ----------------------------------------------------
     CLEANUP
  ---------------------------------------------------- */
  function cleanup() {
    try {
      socketRef.current.disconnect();
    } catch {}

    try {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}

    Object.values(peersRef.current).forEach((pc) => {
      try {
        pc.close();
      } catch {}
    });

    peersRef.current = {};
  }

  /* ----------------------------------------------------
     RENDER
  ---------------------------------------------------- */
  return (
    <div className="video-container">
      <div className="topbar">
        <div className="roomLabel">
          Gup-Shap — Room:
          <span className="roomId">{roomId}</span>
        </div>

        <div className="statusBadges">
          {isHost && <div className="hostBadge">Host</div>}
          <div className="countBadge">{participants.length} participants</div>
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
          <div className="localLabel">
            {localStorage?.user
              ? JSON.parse(localStorage.user).name
              : "You"}
          </div>
        </div>
      </div>

      <CallControls
        micOn={micOn}
        camOn={camOn}
        isSharingScreen={isSharingScreen}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
        onStartScreenShare={startScreenShare}
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
