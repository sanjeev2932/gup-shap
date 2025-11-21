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
  const peersRef = useRef({});
  const socketRef = useRef();
  const localStreamRef = useRef(null);

  const [roomId, setRoomId] = useState("");
  const [participants, setParticipants] = useState([]);
  const [streams, setStreams] = useState({});
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [toast, setToast] = useState("");

  // ACTIVE SPEAKER + PIN
  const [activeId, setActiveId] = useState(null); // active speaker id
  const [pinnedId, setPinnedId] = useState(null); // pinned id (manual)
  const audioAnalyserRef = useRef({}); // id -> { ctx, analyser, interval }
  const activeFallbackTimerRef = useRef(null);
  const hostIdRef = useRef(null);

  // ----------------- Toast helper -----------------
  function showToast(msg, t = 2500) {
    setToast(msg);
    setTimeout(() => setToast(""), t);
  }

  // ----------------- Init socket and join -----------------
  useEffect(() => {
    const room = window.location.pathname.split("/")[2] || "lobby";
    setRoomId(room);

    socketRef.current = io(SIGNAL_SERVER, { transports: ["websocket"] });

    socketRef.current.on("connect", () => {
      const username = localStorage.user ? JSON.parse(localStorage.user).name : "Guest";
      socketRef.current.emit("join-request", { room, username });
    });

    socketRef.current.on("joined", async (payload) => {
      setParticipants(payload.members || []);
      setIsHost(payload.isHost);
      hostIdRef.current = payload.isHost ? socketRef.current.id : null;
      await startLocalMedia(payload.members || []);
      showToast("You joined the room");
    });

    socketRef.current.on("approved", async (payload) => {
      setParticipants(payload.members || []);
      await startLocalMedia(payload.members || []);
      showToast("Approved — you are in");
    });

    socketRef.current.on("members", (list) => {
      setParticipants(list || []);
    });

    socketRef.current.on("lobby-request", ({ id: reqId, username }) => {
      // show pending in participants (handled on provider)
      setParticipants(prev => {
        const exists = prev.find(p => p.id === reqId);
        if (exists) return prev.map(p => p.id === reqId ? { ...p, pending: true } : p);
        return [...prev, { id: reqId, username, pending: true }];
      });
      showToast(`${username || reqId} requested to join`);
    });

    socketRef.current.on("screen-share", ({ from, sharing }) => {
      setParticipants(prev => prev.map(p => p.id === from ? { ...p, sharing } : p));
      showToast(sharing ? "Someone started screen sharing" : "Screen share stopped");
    });

    socketRef.current.on("user-joined", ({ id, username }) => {
      showToast(`${username || "User"} joined`);
      socketRef.current.emit("get-members", { room });
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
      showToast(`${username || from} raised their hand`);
      setParticipants(prev => prev.map(p => p.id === from ? { ...p, raised: true } : p));
      setTimeout(() => setParticipants(prev => prev.map(p => p.id === from ? { ...p, raised: false } : p)), 6000);
    });

    socketRef.current.on("user-left", ({ id: leftId }) => {
      // cleanup peer + stream + analyser
      const pc = peersRef.current[leftId];
      if (pc) { try { pc.close(); } catch {} delete peersRef.current[leftId]; }
      setParticipants(prev => prev.filter(p => p.id !== leftId));
      removeRemoteStream(leftId);
    });

    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------- Local media -----------------
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

    // create offers for existing members
    for (const m of existingMembers) {
      if (m.id !== socketRef.current.id) await createPeerAndOffer(m.id);
    }
  }

  // ----------------- Peer helpers -----------------
  async function createPeerAndOffer(remoteId) {
    if (peersRef.current[remoteId]) return;

    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    peersRef.current[remoteId] = pc;

    // attach local tracks
    localStreamRef.current?.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));

    pc.ontrack = (e) => attachRemoteStream(remoteId, e.streams[0]);
    pc.onicecandidate = (e) => {
      if (e.candidate) socketRef.current.emit("signal", { to: remoteId, type: "candidate", data: e.candidate });
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
      pc.ontrack = (e) => attachRemoteStream(from, e.streams[0]);
      pc.onicecandidate = (e) => { if (e.candidate) socketRef.current.emit("signal", { to: from, type: "candidate", data: e.candidate }); };
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socketRef.current.emit("signal", { to: from, type: "answer", data: answer });
  }

  // ----------------- Streams attach/remove -----------------
  function attachRemoteStream(peerId, stream) {
    // save stream in state
    setStreams(prev => ({ ...prev, [peerId]: stream }));

    // ensure participant exists
    setParticipants(prev => {
      if (!prev.find(p => p.id === peerId)) return [...prev, { id: peerId, username: peerId }];
      return prev;
    });

    // setup analyser for active speaker detection
    setupAnalyserFor(peerId, stream);
  }

  function removeRemoteStream(peerId) {
    teardownAnalyserFor(peerId);
    setStreams(prev => {
      const c = { ...prev };
      delete c[peerId];
      return c;
    });
  }

  // ----------------- Active speaker analyser -----------------
  function setupAnalyserFor(id, stream) {
    try {
      if (audioAnalyserRef.current[id]) return; // already active

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);

      let lastSpokeAt = Date.now();

      const interval = setInterval(() => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length);

        // threshold tuned for general mics; adjust if noisy
        if (rms > 14) {
          lastSpokeAt = Date.now();

          // if not pinned (manual pin should override active), set active
          setActiveId(prev => {
            if (pinnedId) return prev; // do not override when pinned
            if (prev === id) return prev;
            return id;
          });

          // refresh fallback timer
          startActiveFallbackTimer();
        } else {
          // if silence for 4s, clear active if this id is active
          if (Date.now() - lastSpokeAt > 4000) {
            setActiveId(prev => (prev === id ? null : prev));
          }
        }
      }, 220);

      audioAnalyserRef.current[id] = { ctx, analyser, interval };
      // ensure fallback (in case nobody speaks)
      startActiveFallbackTimer();
    } catch (e) {
      console.warn("Analyser setup failed:", e);
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

  function startActiveFallbackTimer() {
    if (activeFallbackTimerRef.current) clearTimeout(activeFallbackTimerRef.current);
    activeFallbackTimerRef.current = setTimeout(() => {
      // if pinned, keep pinned; else spotlight host or first participant
      if (pinnedId) return;
      const host = participants.find(p => p.id === hostIdRef.current) || participants[0];
      if (host) setActiveId(host.id);
      else setActiveId(null);
    }, 6000);
  }

  // ----------------- control toggles -----------------
  const toggleMic = () => {
    if (!localStreamRef.current) return;
    const tr = localStreamRef.current.getAudioTracks();
    if (!tr.length) return;
    tr.forEach(t => t.enabled = !t.enabled);
    setMicOn(tr[0].enabled);
    socketRef.current.emit("media-update", { room: roomId, mic: tr[0].enabled });
  };

  const toggleCam = () => {
    if (!localStreamRef.current) return;
    const tr = localStreamRef.current.getVideoTracks();
    if (!tr.length) return;
    tr.forEach(t => t.enabled = !t.enabled);
    setCamOn(tr[0].enabled);
    socketRef.current.emit("media-update", { room: roomId, cam: tr[0].enabled });
  };

  // Screen-share toggle (keeps earlier behavior)
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
      console.log("Screen share cancelled or failed", e);
    }
  };

  // ----------------- raise hand -----------------
  const raiseHand = () => {
    const username = localStorage.user ? JSON.parse(localStorage.user).name : "Guest";
    socketRef.current.emit("raise-hand", { room: roomId, raised: true, username });
    showToast("You raised your hand");
  };

  // ----------------- pin toggle -----------------
  function togglePin(id) {
    setPinnedId(prev => {
      const next = prev === id ? null : id;
      // if pin set, disable active-speaker auto-spotlight
      if (next) setActiveId(null);
      return next;
    });
  }

  const approveParticipant = (userId) => {
    socketRef.current.emit("approve-join", { room: roomId, userId });
    setParticipants(prev => prev.map(p => p.id === userId ? { ...p, pending: false } : p));
  };

  const endCall = () => {
    cleanup();
    window.location.href = "/";
  };

  // ----------------- cleanup -----------------
  function cleanup() {
    try { socketRef.current?.disconnect(); } catch {}
    try { localStreamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    Object.values(peersRef.current).forEach(pc => { try { pc.close(); } catch {} });
    peersRef.current = {};
    // teardown analysers
    Object.keys(audioAnalyserRef.current).forEach(id => teardownAnalyserFor(id));
    if (activeFallbackTimerRef.current) clearTimeout(activeFallbackTimerRef.current);
  }

  // ----------------- tiles rendering: active/pinned sizing -----------------
  // Build a stable list of tiles (participants + streams); prioritize sharer/pinned/active
  const tiles = (() => {
    const ids = new Set();
    (participants || []).forEach(p => ids.add(p.id));
    Object.keys(streams).forEach(id => ids.add(id));
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

    // sort: screen-sharer first, then pinned, then active, then host, then alphabetical
    const sharer = arr.find(a => a.sharing);
    const host = participants.find(p => p.id === hostIdRef.current);
    arr.sort((a, b) => {
      if (a.id === sharer?.id) return -1;
      if (b.id === sharer?.id) return 1;
      if (a.id === pinnedId) return -1;
      if (b.id === pinnedId) return 1;
      if (!pinnedId && a.id === activeId) return -1;
      if (!pinnedId && b.id === activeId) return 1;
      if (a.id === host?.id) return -1;
      if (b.id === host?.id) return 1;
      return (a.username || "").localeCompare(b.username || "");
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
        <div id="remote-videos" className={`remoteGrid ${pinnedId || activeId ? "has-spotlight" : ""}`}>
          {tiles.map(t => (
            <VideoTile
              key={t.id}
              id={t.id}
              username={t.username}
              stream={streams[t.id]}
              active={!pinnedId && activeId === t.id}
              sharing={t.sharing}
              raised={t.raised}
              pinned={pinnedId === t.id}
              onPin={togglePin}
            />
          ))}
        </div>

        <div className={`localFloating ${isSharingScreen ? "sharing" : ""}`}>
          <video ref={localRef} autoPlay muted playsInline className="localVideo" />
          <div className="localLabel">{localStorage?.user ? JSON.parse(localStorage.user).name : "You"}</div>
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
