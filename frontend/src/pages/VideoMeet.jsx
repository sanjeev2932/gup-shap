// frontend/src/pages/VideoMeet.jsx
import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import CallControls from "../components/CallControls";
import "../styles/videoComponent.css";
import "../styles/videoMeetOverrides.css";
import ringFile from "../assets/join-ring.mp3";

const SIGNAL_SERVER = "https://gup-shapbackend.onrender.com"; // your backend domain

export default function VideoMeet() {
  const localVideoRef = useRef(null);
  const peerConnections = useRef({}); // mapping: peerId -> RTCPeerConnection
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const videoRefs = useRef({}); // mapping: peerId -> video element ref

  const [roomId, setRoomId] = useState("");
  const [participants, setParticipants] = useState([]); // { id, username }
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const ringAudioRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isWaitingLobby, setIsWaitingLobby] = useState(false);
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    // derive room from url
    const id = (window.location.pathname.replace("/", "") || "lobby");
    setRoomId(id);

    // socket connect
    socketRef.current = io(SIGNAL_SERVER, { transports: ["websocket"] });

    socketRef.current.on("connect", () => {
      console.log("Connected to signaling:", socketRef.current.id);
      // request to join
      const username = localStorage?.user ? JSON.parse(localStorage.user).name : "Guest";
      socketRef.current.emit("join-request", { room: id, username });
    });

    // server responses
    socketRef.current.on("lobby-wait", ({ hostId }) => {
      setIsWaitingLobby(true);
      setIsHost(false);
      console.log("Waiting in lobby, host:", hostId);
    });

    socketRef.current.on("joined", async (payload) => {
      // direct join (first user becomes host)
      setIsWaitingLobby(false);
      setIsHost(Boolean(payload.isHost));
      setParticipants(payload.members || []);
      await startLocalMedia(); // set up local media and create offers to others
      setIsConnected(true);
    });

    socketRef.current.on("approved", async (payload) => {
      // got approved by host
      setIsWaitingLobby(false);
      setParticipants(payload.members || []);
      await startLocalMedia();
      setIsConnected(true);
    });

    socketRef.current.on("members", (members) => {
      setParticipants(members || []);
    });

    socketRef.current.on("lobby-request", (payload) => {
      // host sees pending requests (show in UI if desired)
      console.log("Lobby request (host):", payload);
    });

    socketRef.current.on("user-joined", ({ id: newId, username }) => {
      // play ring and request updated members
      playRing();
      socketRef.current.emit("get-members", { room: id });
    });

    socketRef.current.on("signal", async ({ from, type, data }) => {
      if (type === "offer") {
        await handleOffer(from, data);
      } else if (type === "answer") {
        const pc = peerConnections.current[from];
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data));
      } else if (type === "candidate") {
        const pc = peerConnections.current[from];
        if (pc) {
          try { await pc.addIceCandidate(data); } catch (e) { console.warn("addIce failed", e); }
        }
      }
    });

    socketRef.current.on("user-left", ({ id: leftId }) => {
      // remove participant and close peer
      setParticipants(prev => prev.filter(p => p.id !== leftId));
      const pc = peerConnections.current[leftId];
      if (pc) {
        try { pc.close(); } catch (e) {}
        delete peerConnections.current[leftId];
      }
      // remove video element
      const el = document.querySelector(`[data-peer="${leftId}"]`);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });

    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // when participants list changes, ensure vids mount for existing streams
  useEffect(() => {
    // for any participant that has a streamRef stored (streams are applied in ontrack)
    participants.forEach(p => {
      const ref = videoRefs.current[p.id];
      if (ref && ref.srcObject && ref.srcObject instanceof MediaStream) {
        // already set
      }
    });
  }, [participants]);

  async function startLocalMedia() {
    if (!localStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: camOn, audio: micOn });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch (e) {
        console.error("getUserMedia error:", e);
        return;
      }
    }

    // create offers to all other participants
    for (const member of participants) {
      if (member.id === socketRef.current.id) continue;
      await createPeerAndOffer(member.id);
    }
  }

  async function createPeerAndOffer(remoteId) {
    if (peerConnections.current[remoteId]) return;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

    // add local tracks to pc
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current.emit("signal", { to: remoteId, type: "candidate", data: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      // ensure a video element exists for remote
      attachRemoteStream(remoteId, e.streams[0]);
    };

    peerConnections.current[remoteId] = pc;

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current.emit("signal", { to: remoteId, type: "offer", data: offer });
    } catch (e) {
      console.error("offer creation failed", e);
    }
  }

  async function handleOffer(from, offer) {
    let pc = peerConnections.current[from];
    if (!pc) {
      pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      peerConnections.current[from] = pc;

      // add local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) socketRef.current.emit("signal", { to: from, type: "candidate", data: e.candidate });
      };

      pc.ontrack = (e) => {
        attachRemoteStream(from, e.streams[0]);
      };
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socketRef.current.emit("signal", { to: from, type: "answer", data: answer });
  }

  const attachRemoteStream = (peerId, stream) => {
    // add participant to state if not present
    setParticipants(prev => {
      if (!prev.find(p => p.id === peerId)) {
        return [...prev, { id: peerId, username: peerId }];
      }
      return prev;
    });

    // create or update video element
    let el = document.querySelector(`[data-peer="${peerId}"]`);
    if (!el) {
      const container = document.getElementById("remote-videos");
      if (!container) return;
      el = document.createElement("video");
      el.setAttribute("data-peer", peerId);
      el.autoplay = true;
      el.playsInline = true;
      el.muted = false;
      el.className = "remote-video";
      const wrapper = document.createElement("div");
      wrapper.className = "remote-video-wrap";
      const label = document.createElement("div");
      label.className = "video-username";
      label.innerText = peerId;
      wrapper.appendChild(el);
      wrapper.appendChild(label);
      container.appendChild(wrapper);
    }
    try {
      el.srcObject = stream;
    } catch (e) {
      // older browsers fallback
      el.src = URL.createObjectURL(stream);
    }
    videoRefs.current[peerId] = el;
  };

  function playRing() {
    if (!ringAudioRef.current) {
      ringAudioRef.current = new Audio(ringFile);
      ringAudioRef.current.volume = 0.6;
    }
    ringAudioRef.current.play().catch(() => {});
  }

  const toggleMic = () => {
    if (!localStreamRef.current) return;
    const audioTracks = localStreamRef.current.getAudioTracks();
    if (!audioTracks.length) return;
    audioTracks.forEach(t => (t.enabled = !t.enabled));
    setMicOn(audioTracks[0].enabled);
  };

  const toggleCam = () => {
    if (!localStreamRef.current) return;
    const videoTracks = localStreamRef.current.getVideoTracks();
    if (!videoTracks.length) return;
    videoTracks.forEach(t => (t.enabled = !t.enabled));
    setCamOn(videoTracks[0].enabled);
  };

  const startScreenShare = async () => {
    try {
      const disp = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = disp.getVideoTracks()[0];

      for (const pid in peerConnections.current) {
        const sender = peerConnections.current[pid].getSenders().find(s => s.track && s.track.kind === "video");
        if (sender) sender.replaceTrack(screenTrack);
      }

      // local preview as screen share
      if (localVideoRef.current) localVideoRef.current.srcObject = disp;
      setIsSharingScreen(true);

      screenTrack.onended = () => {
        // restore camera
        if (localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
          for (const pid in peerConnections.current) {
            const sender = peerConnections.current[pid].getSenders().find(s => s.track && s.track.kind === "video");
            if (sender) sender.replaceTrack(localStreamRef.current.getVideoTracks()[0]);
          }
        }
        setIsSharingScreen(false);
      };
    } catch (e) {
      console.error("Screen share failed", e);
    }
  };

  const endCall = () => {
    cleanup();
    window.location.href = "/"; // back to home
  };

  const approveParticipant = (userId) => {
    socketRef.current.emit("approve-join", { room: roomId, userId });
  };

  const raiseHand = () => {
    socketRef.current.emit("raise-hand", { room: roomId, raised: true });
  };

  function cleanup() {
    try { socketRef.current?.disconnect(); } catch (e) {}
    try {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    } catch (e) {}
    Object.values(peerConnections.current).forEach(pc => { try { pc.close(); } catch (e) {} });
    peerConnections.current = {};
    videoRefs.current = {};
    setParticipants([]);
    setIsConnected(false);
  }

  return (
    <div className="meet-container">
      <div className="meet-topbar">
        <h2>Gup-Shap — Room: <span className="room-id">{roomId}</span></h2>
        <div className="room-actions">
          {isWaitingLobby && <div className="lobby-note">Waiting for host approval...</div>}
          {isHost && <div className="host-badge">Host</div>}
        </div>
      </div>

      <div className="video-stage">
        <div id="remote-videos" className="remote-grid" />
        <div className="local-floating">
          <video ref={localVideoRef} autoPlay muted playsInline className="local-video" />
          <div className="local-label">{localStorage?.user ? JSON.parse(localStorage.user).name : "You"}</div>
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
    </div>
  );
}
