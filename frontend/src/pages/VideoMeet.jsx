// frontend/src/pages/VideoMeet.jsx
import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import CallControls from "../components/CallControls";
import VideoTile from "../components/";
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
  const [activeId, setActiveId] = useState(null);

  // -----------------------------------------------------
  // TOAST
  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  // -----------------------------------------------------
  // INIT SOCKET + JOIN ROOM
  useEffect(() => {
    const paths = window.location.pathname.split("/");
    const id = paths[2] || "lobby";
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
      setIsHost(payload.isHost);
      await startLocalMedia(payload.members || []);
    });

    socketRef.current.on("approved", async (payload) => {
      setParticipants(payload.members || []);
      await startLocalMedia(payload.members || []);
    });

    socketRef.current.on("members", (list) => {
      setParticipants(list || []);
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

    socketRef.current.on("user-left", ({ id }) => {
      if (peersRef.current[id]) peersRef.current[id].close();
      delete peersRef.current[id];
      removeRemoteStream(id);
    });

    return () => cleanup();
  }, []);

  // -----------------------------------------------------
  // LOCAL MEDIA
  async function startLocalMedia(members) {
    if (!localStreamRef.current) {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: camOn,
        audio: micOn,
      });
      localStreamRef.current = stream;
      if (localRef.current) localRef.current.srcObject = stream;
    }

    for (const m of members) {
      if (m.id !== socketRef.current.id) {
        await createPeerAndOffer(m.id);
      }
    }
  }

  // -----------------------------------------------------
  // PEER CONNECTION
  async function createPeerAndOffer(remoteId) {
    if (peersRef.current[remoteId]) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peersRef.current[remoteId] = pc;

    localStreamRef.current.getTracks().forEach((track) =>
      pc.addTrack(track, localStreamRef.current)
    );

    pc.ontrack = (e) => attachRemoteStream(remoteId, e.streams[0]);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current.emit("signal", {
          to: remoteId,
          type: "candidate",
          data: e.candidate,
        });
      }
    };

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

      pc.ontrack = (e) => attachRemoteStream(from, e.streams[0]);

      pc.onicecandidate = (e) => {
        if (e.candidate)
          socketRef.current.emit("signal", {
            to: from,
            type: "candidate",
            data: e.candidate,
          });
      };
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

  // -----------------------------------------------------
  // STREAM ATTACH
  function attachRemoteStream(peerId, stream) {
    setStreams((prev) => ({ ...prev, [peerId]: stream }));

    setParticipants((prev) => {
      if (!prev.find((p) => p.id === peerId))
        return [...prev, { id: peerId, username: peerId }];
      return prev;
    });
  }

  function removeRemoteStream(peerId) {
    setStreams((prev) => {
      const c = { ...prev };
      delete c[peerId];
      return c;
    });
  }

  // -----------------------------------------------------
  // CONTROLS
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

  const endCall = () => {
    cleanup();
    window.location.href = "/";
  };

  function cleanup() {
    try {
      socketRef.current.disconnect();
    } catch {}
    try {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    } catch {}
    Object.values(peersRef.current).forEach((pc) => pc.close());
  }

  // -----------------------------------------------------
  // UI RENDER
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
        <div className="remoteGrid">
          {participants.map((p) => (
            <VideoTile
              key={p.id}
              id={p.id}
              username={p.username}
              stream={streams[p.id]}
              active={activeId === p.id}
              sharing={p.sharing}
              raised={p.raised}
            />
          ))}
        </div>

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
        onStartScreenShare={() => {}}
        onEndCall={endCall}
        onRaiseHand={() => {}}
        isHost={isHost}
        participants={participants}
        onApproveParticipant={() => {}}
      />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
