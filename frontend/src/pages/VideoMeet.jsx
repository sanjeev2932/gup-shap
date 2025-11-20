// frontend/src/pages/VideoMeet.jsx
import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import CallControls from "../components/CallControls";
import VideoTile from "../components/VideoTile";
import "../styles/videoComponent.css";
import "../styles/videoMeetOverrides.css";

const SIGNAL_SERVER = "https://gup-shapbackend.onrender.com";

export default function VideoMeet() {
  const localRef = useRef();
  const peersRef = useRef({}); // RTCPeerConnection map
  const socketRef = useRef();
  const localStreamRef = useRef(null);

  const [roomId, setRoomId] = useState("");
  const [participants, setParticipants] = useState([]); // array of {id, username, pending, mic, cam, sharing, raised}
  const [streams, setStreams] = useState({}); // id -> MediaStream
  const streamsRef = useRef({}); // mirror to avoid stale closures
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [toast, setToast] = useState("");
  const [activeId, setActiveId] = useState(null);
  const audioAnalyserRef = useRef({}); // id -> {ctx, analyser, interval}
  const hostIdRef = useRef(null);

  // ------------------------------------------------------------------
  // UTIL: show toast
  // ------------------------------------------------------------------
  function showToast(msg, t = 3000) {
    setToast(msg);
    setTimeout(() => setToast(""), t);
  }

  // ------------------------------------------------------------------
  // START: parse room and connect socket
  // ------------------------------------------------------------------
  useEffect(() => {
    const paths = window.location.pathname.split("/");
    // expecting /meet/:roomId
    const id = paths[2] || paths[1] || "lobby";
    setRoomId(id);

    socketRef.current = io(SIGNAL_SERVER, { transports: ["websocket"] });

    socketRef.current.on("connect", () => {
      const username = localStorage?.user ? JSON.parse(localStorage.user).name : "Guest";
      socketRef.current.emit("join-request", { room: id, username });
    });

    // --- joined directly (host or approved)
    socketRef.current.on("joined", async (payload) => {
      setParticipants(payload.members || []);
      setIsHost(Boolean(payload.isHost));
      hostIdRef.current = payload.isHost ? socketRef.current.id : null;
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
      // preserve pending flags already in local participants list
      setParticipants((prev) => {
        const pendingMap = {};
        prev.forEach(p => { if (p.pending) pendingMap[p.id] = true; });
        const newMembers = (m || []).map(x => ({ ...x, pending: false }));
        return newMembers.map(n => ({ ...n, pending: pendingMap[n.id] || false }));
      });
      // update hostRef if provided
      const host = (m || []).find(mm => mm.id && mm.id === socketRef.current.id); // no host info here, keep hostRef separate
      // nothing else
    });

    socketRef.current.on("lobby-request", ({ id: reqId, username }) => {
      // host receives pending request
      setParticipants(prev => {
        const exists = prev.find(p => p.id === reqId);
        if (exists) return prev.map(p => p.id === reqId ? { ...p, pending: true } : p);
        return [...prev, { id: reqId, username, pending: true }];
      });
      showToast(`${username || reqId} requested to join`);
    });

    socketRef.current.on("user-joined", ({ id: uid, username }) => {
      playDing();
      showToast(`${username || "User"} joined`);
      socketRef.current.emit("get-members", { room: id });
    });

    socketRef.current.on("screen-share", ({ from, sharing }) => {
      setParticipants(prev => prev.map(p => p.id === from ? { ...p, sharing } : p));
      if (sharing) showToast("Someone started screen sharing");
      else showToast("Screen share stopped");
    });

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
      setTimeout(() => setParticipants(prev => prev.map(p => p.id === from ? { ...p, raised: false } : p)), 6000);
    });

    socketRef.current.on("user-left", ({ id: leftId }) => {
      // close peer
      const pc = peersRef.current[leftId];
      if (pc) {
        try { pc.close(); } catch {}
        delete peersRef.current[leftId];
      }
      // remove stream and participant
      setParticipants(prev => prev.filter(p => p.id !== leftId));
      removeRemoteStream(leftId);
    });

    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // tiny ding used earlier
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

  // ------------------------------------------------------------------
  // LOCAL MEDIA START
  // ------------------------------------------------------------------
  async function startLocalMedia(existingMembers = []) {
    if (!localStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: camOn, audio: micOn });
        localStreamRef.current = stream;
        if (localRef.current) localRef.current.srcObject = stream;
      } catch (e) {
        showToast("Camera/Mic permission denied");
        return;
      }
    }

    // create offers to existing remote members
    for (const m of existingMembers) {
      if (m.id !== socketRef.current.id) {
        await createPeerAndOffer(m.id);
      }
    }
  }

  // ------------------------------------------------------------------
  // PEER CONNECTION helpers
  // ------------------------------------------------------------------
  async function createPeerAndOffer(remoteId) {
    if (peersRef.current[remoteId]) return;

    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    peersRef.current[remoteId] = pc;

    // add local tracks to peer
    localStreamRef.current?.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));

    pc.onicecandidate = (e) => {
      if (e.candidate) socketRef.current.emit("signal", { to: remoteId, type: "candidate", data: e.candidate });
    };

    pc.ontrack = (e) => {
      // when remote sends a track we attach the whole stream
      const st = e.streams[0];
      attachRemoteStream(remoteId, st);
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socketRef.current.emit("signal", { to: remoteId, type: "offer", data: offer });
  }

  async function handleOffer(from, offer) {
    let pc = peersRef.current[from];
    if (!pc) {
      pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      peersRef.current[from] = pc;

      localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current));

      pc.onicecandidate = (e) => {
        if (e.candidate) socketRef.current.emit("signal", { to: from, type: "candidate", data: e.candidate });
      };

      pc.ontrack = (e) => attachRemoteStream(from, e.streams[0]);
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socketRef.current.emit("signal", { to: from, type: "answer", data: answer });
  }

  // ------------------------------------------------------------------
  // Attach / remove remote stream (react state)
  // ------------------------------------------------------------------
  function attachRemoteStream(peerId, stream) {
    // store stream in refs + state
    streamsRef.current = { ...streamsRef.current, [peerId]: stream };
    setStreams(curr => ({ ...curr, [peerId]: stream }));

    // ensure participant exists (username unknown sometimes)
    setParticipants(prev => {
      if (!prev.find(p => p.id === peerId)) return [...prev, { id: peerId, username: peerId }];
      return prev;
    });

    // set up analyser for active speaker
    setupAnalyserFor(peerId, stream);
  }

  function removeRemoteStream(peerId) {
    // remove analyser
    teardownAnalyserFor(peerId);

    streamsRef.current = { ...streamsRef.current };
    delete streamsRef.current[peerId];
    setStreams(curr => {
      const clone = { ...curr };
      delete clone[peerId];
      return clone;
    });
  }

  // ------------------------------------------------------------------
  // Active speaker analyser
  // ------------------------------------------------------------------
  // sets up analyser that samples RMS and updates activeId
  function setupAnalyserFor(id, stream) {
    try {
      if (audioAnalyserRef.current[id]) return; // already set
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);

      const interval = setInterval(() => {
        analyser.getByteFrequencyData(data);
        // compute RMS-ish loudness
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length);
        // low threshold noise filter
        if (rms > 12) {
          // candidate for active speaker
          setActiveId(prev => {
            // if new loudest, set it
            return id;
          });
        } else {
          // if quiet and it's currently active, consider clearing after delay handled by fallback timer below
        }
      }, 250);

      audioAnalyserRef.current[id] = { ctx, analyser, interval };
      // start fallback timeout clearing: when silence for 6s -> fallback host
      startActiveFallbackTimer();
    } catch (e) {
      console.warn("Analyser setup failed for", id, e);
    }
  }

  function teardownAnalyserFor(id) {
    const rec = audioAnalyserRef.current[id];
    if (!rec) return;
    try {
      clearInterval(rec.interval);
      rec.ctx.close();
    } catch {}
    delete audioAnalyserRef.current[id];
  }

  // fallback: if no active update for 6s, spotlight host (if host exists) or clear
  const activeFallbackTimerRef = useRef(null);
  function startActiveFallbackTimer() {
    if (activeFallbackTimerRef.current) {
      clearTimeout(activeFallbackTimerRef.current);
    }
    activeFallbackTimerRef.current = setTimeout(() => {
      // find host from participants if any
      const host = participants.find(p => p.id === hostIdRef.current) || participants[0];
      if (host) setActiveId(host.id);
      else setActiveId(null);
    }, 6000);
  }

  // ------------------------------------------------------------------
  // Controls: mic / cam toggle
  // ------------------------------------------------------------------
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

  // Screen share (toggle)
  const startScreenShare = async () => {
    if (!localStreamRef.current) { showToast("Local media not started"); return; }

    if (isSharingScreen) {
      // stop share: replace with camera track
      const camTrack = localStreamRef.current.getVideoTracks()[0];
      if (!camTrack) return;
      Object.values(peersRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
        if (sender) sender.replaceTrack(camTrack);
      });
      if (localRef.current) localRef.current.srcObject = localStreamRef.current;
      setIsSharingScreen(false);
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
      if (socketRef.current?.connected) socketRef.current.emit("screen-share", { room: roomId, from: socketRef.current.id, sharing: true });

      track.onended = () => {
        // revert to camera
        const camTrack = localStreamRef.current?.getVideoTracks()[0];
        Object.values(peersRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
          if (sender && camTrack) sender.replaceTrack(camTrack);
        });
        if (localRef.current && localStreamRef.current) localRef.current.srcObject = localStreamRef.current;
        setIsSharingScreen(false);
        if (socketRef.current?.connected) socketRef.current.emit("screen-share", { room: roomId, from: socketRef.current.id, sharing: false });
      };
    } catch (e) {
      // user cancelled display pick
      console.log("Screen share cancelled", e);
    }
  };

  const raiseHand = () => {
    const username = localStorage.user ? JSON.parse(localStorage.user).name : "Guest";
    socketRef.current.emit("raise-hand", { room: roomId, raised: true, username });
    showToast("You raised your hand");
  };

  const approveParticipant = (userId) => {
    socketRef.current.emit("approve-join", { room: roomId, userId });
    setParticipants(prev => prev.map(p => p.id === userId ? { ...p, pending: false } : p));
  };

  const endCall = () => {
    cleanup();
    window.location.href = "/";
  };

  // ------------------------------------------------------------------
  // Cleanup
  // ------------------------------------------------------------------
  function cleanup() {
    try { socketRef.current?.disconnect(); } catch {}
    try { localStreamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    Object.values(peersRef.current).forEach(pc => { try { pc.close(); } catch {} });
    peersRef.current = {};
    // teardown analysers
    Object.keys(audioAnalyserRef.current).forEach(id => teardownAnalyserFor(id));
    if (activeFallbackTimerRef.current) clearTimeout(activeFallbackTimerRef.current);
  }

  // ------------------------------------------------------------------
  // Render tiles
  // ------------------------------------------------------------------
  // Build a stable list: include participants (from server) and any streams present
  const tiles = (() => {
    const ids = new Set();
    (participants || []).forEach(p => ids.add(p.id));
    Object.keys(streams).forEach(id => ids.add(id));
    // Build array sorted: screen sharer first, then host, then others
    const arr = Array.from(ids).map(id => {
      const p = participants.find(pp => pp.id === id) || { id, username: id };
      return {
        id,
        username: p.username || id,
        pending: !!p.pending,
        sharing: !!p.sharing,
        raised: !!p.raised,
      };
    });

    // if someone is sharing, put them first
    const sharer = arr.find(a => a.sharing);
    const host = participants.find(p => p.id === hostIdRef.current);
    arr.sort((a, b) => {
      if (a.id === sharer?.id) return -1;
      if (b.id === sharer?.id) return 1;
      if (a.id === host?.id) return -1;
      if (b.id === host?.id) return 1;
      if (a.id === activeId) return -1;
      if (b.id === activeId) return 1;
      return a.username.localeCompare(b.username || "");
    });
    return arr;
  })();

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
        <div id="remote-videos" className="remoteGrid" aria-live="polite">
          {/* Render tiles */}
          {tiles.map(t => (
            <VideoTile
              key={t.id}
              id={t.id}
              username={t.username}
              stream={streams[t.id]}
              active={activeId === t.id}
              sharing={t.sharing}
              raised={t.raised}
            />
          ))}
        </div>

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
        onStartScreenShare={startScreenShare} // toggle-style
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
