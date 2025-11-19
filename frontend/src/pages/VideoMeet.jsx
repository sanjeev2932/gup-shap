// frontend/src/pages/VideoMeet.jsx
import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import CallControls from "../components/CallControls";
import "../styles/videoComponent.css";
import "../styles/floatingSelf.css";
import ringFile from "../assets/join-ring.mp3"; // you'll add a small mp3 in src/assets

const SIGNAL_SERVER = "https://gup-shapbackend.onrender.com"; // your backend

export default function VideoMeet() {
  const localRef = useRef();
  const peersRef = useRef({}); // { peerId: RTCPeerConnection }
  const streamsRef = useRef({}); // store remote streams
  const socketRef = useRef();
  const localStreamRef = useRef(null);
  const [roomId, setRoomId] = useState("");
  const [participants, setParticipants] = useState([]); // list of {id, username}
  const [isHost, setIsHost] = useState(false);
  const ringAudioRef = useRef(null);

  useEffect(() => {
    // room from url
    const id = (window.location.pathname.replace("/", "") || "lobby");
    setRoomId(id);

    // socket connect
    socketRef.current = io(SIGNAL_SERVER, { transports: ["websocket"] });

    socketRef.current.on("connect", () => {
      console.log("connected to signaling", socketRef.current.id);
      // send join request (server can decide lobby)
      socketRef.current.emit("join-request", { room: id, username: localStorage?.user ? JSON.parse(localStorage.user).name : "Anon" });
    });

    // server might reply 'lobby' or 'joined'
    socketRef.current.on("lobby-wait", (payload) => {
      // payload: { hostId }
      console.log("In lobby, waiting approval...", payload);
      // show UI note? For now just console.
    });

    socketRef.current.on("approved", async (payload) => {
      // payload contains full room members list
      console.log("approved to join room", payload);
      await startLocalAndSignal(id, payload.members);
      setParticipants(payload.members || []);
      setIsHost(payload.isHost || false);
    });

    // if server directly allowed joining, it will send 'joined' with members
    socketRef.current.on("joined", async (payload) => {
      console.log("joined room:", payload);
      setParticipants(payload.members || []);
      setIsHost(payload.isHost || false);
      await startLocalAndSignal(id, payload.members);
    });

    // someone else joined - play ring and prepare to connect
    socketRef.current.on("user-joined", async ({ id: newId, username }) => {
      console.log("user-joined", newId);
      playRing();
      // ask server for members update
      socketRef.current.emit("get-members", { room: id });
    });

    // handle offer/answer/candidate events
    socketRef.current.on("signal", async ({ from, type, data }) => {
      if (type === "offer") {
        await handleRemoteOffer(from, data);
      } else if (type === "answer") {
        const pc = peersRef.current[from];
        if (pc) pc.setRemoteDescription(new RTCSessionDescription(data));
      } else if (type === "candidate") {
        const pc = peersRef.current[from];
        if (pc) {
          try { await pc.addIceCandidate(data); } catch (e) {}
        }
      }
    });

    socketRef.current.on("members", (m) => {
      setParticipants(m || []);
    });

    socketRef.current.on("raise-hand", ({ from, username }) => {
      // display a quick toast or UI; for now console
      console.log(`${username || from} raised hand`);
      // if host we could show approval buttons
    });

    socketRef.current.on("lobby-request", (payload) => {
      // host receives a pending joiner; host should show a small list to approve
      console.log("lobby-request", payload);
      // parent UI can use this to show approve controls (omitted for brevity)
    });

    return () => {
      cleanupAll();
    };
  }, []);

  async function startLocalAndSignal(room, members = []) {
    if (!localStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localRef.current) localRef.current.srcObject = stream;
      } catch (e) {
        console.error("getUserMedia error", e);
        return;
      }
    }

    // create offer to all existing members
    for (const member of members) {
      if (member.id === socketRef.current.id) continue;
      await createPeerAndOffer(member.id);
    }
  }

  async function createPeerAndOffer(remoteId) {
    if (peersRef.current[remoteId]) return; // already exists
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

    // local tracks
    localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current.emit("signal", { to: remoteId, type: "candidate", data: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      // create a remote video element
      streamsRef.current[remoteId] = e.streams[0];
      addRemoteVideo(remoteId, e.streams[0]);
    };

    peersRef.current[remoteId] = pc;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socketRef.current.emit("signal", { to: remoteId, type: "offer", data: offer });
  }

  async function handleRemoteOffer(from, offer) {
    // create PC if not exists
    let pc = peersRef.current[from];
    if (!pc) {
      pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socketRef.current.emit("signal", { to: from, type: "candidate", data: e.candidate });
        }
      };

      pc.ontrack = (e) => {
        streamsRef.current[from] = e.streams[0];
        addRemoteVideo(from, e.streams[0]);
      };

      peersRef.current[from] = pc;
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socketRef.current.emit("signal", { to: from, type: "answer", data: answer });
  }

  // add remote video element to the DOM
  const addRemoteVideo = (id, stream) => {
    setParticipants(prev => {
      // ensure participants list updated (server will also broadcast members)
      if (!prev.find(p => p.id === id)) prev = [...prev, { id, username: id }];
      return prev;
    });
    // create or update a video element in markup by id
    const container = document.getElementById("remote-videos");
    let el = document.querySelector(`[data-peer="${id}"]`);
    if (!el) {
      el = document.createElement("video");
      el.setAttribute("data-peer", id);
      el.autoplay = true;
      el.playsInline = true;
      el.className = "remote-video";
      container.appendChild(el);
    }
    el.srcObject = stream;
  };

  function playRing() {
    if (!ringAudioRef.current) {
      ringAudioRef.current = new Audio("/join-ring.mp3");
      ringAudioRef.current.volume = 0.6;
    }
    ringAudioRef.current.play().catch(() => {});
  }

  // Call controls handlers
  const handleToggleMic = (enabled) => { /* optional UI */ };
  const handleToggleCam = (enabled) => { /* optional UI */ };

  const startScreenShare = async () => {
    if (!localStreamRef.current) return;
    try {
      const disp = await navigator.mediaDevices.getDisplayMedia({ video: true });
      // Replace local video track in all peer connections
      const screenTrack = disp.getVideoTracks()[0];
      for (const pid in peersRef.current) {
        const sender = peersRef.current[pid].getSenders().find(s => s.track && s.track.kind === "video");
        if (sender) sender.replaceTrack(screenTrack);
      }
      // show local preview as screen share
      localRef.current.srcObject = disp;
      // when screen share ends, revert to camera
      screenTrack.onended = () => {
        // restore camera
        localRef.current.srcObject = localStreamRef.current;
        for (const pid in peersRef.current) {
          const sender = peersRef.current[pid].getSenders().find(s => s.track && s.track.kind === "video");
          if (sender) sender.replaceTrack(localStreamRef.current.getVideoTracks()[0]);
        }
      };
    } catch (e) {
      console.error("screenshare failed", e);
      throw e;
    }
  };

  const stopScreenShare = async () => {
    // instruct user to manually stop; we rely on onended to revert
    if (localRef.current && localRef.current.srcObject && localRef.current.srcObject.getVideoTracks) {
      const t = localRef.current.srcObject.getVideoTracks()[0];
      if (t && t.kind === "video" && t.stop) t.stop();
    }
    localRef.current.srcObject = localStreamRef.current;
  };

  const handleRaiseHand = (raised) => {
    socketRef.current.emit("raise-hand", { room: roomId, raised });
  };

  // host approve function for waiting lobby
  const approveParticipant = (userId) => {
    socketRef.current.emit("approve-join", { room: roomId, userId });
  };

  const cleanupAll = () => {
    try { socketRef.current?.disconnect(); } catch (e) {}
    try {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    } catch (e) {}
    Object.values(peersRef.current).forEach(pc => { try { pc.close(); } catch (e) {} });
    peersRef.current = {};
    streamsRef.current = {};
  };

  return (
    <div className="video-container">
      <h3>Room: {roomId}</h3>

      <div className="video-stage">
        <div id="remote-videos" className="remote-grid">
          {/* remote videos will be appended by addRemoteVideo */}
        </div>
        <div className="local-stage">
          <video ref={localRef} autoPlay muted playsInline className="local-video" />
        </div>
      </div>

      {/* floating self preview */}
      <div className="floating-self" style={{display: "block"}}>
        <video ref={localRef} autoPlay muted playsInline />
      </div>

      <CallControls
        localStream={localStreamRef.current}
        onToggleMic={handleToggleMic}
        onToggleCam={handleToggleCam}
        onStartScreenShare={startScreenShare}
        onStopScreenShare={stopScreenShare}
        onRaiseHand={handleRaiseHand}
        isHost={isHost}
        onApproveParticipant={approveParticipant}
      />
    </div>
  );
}
