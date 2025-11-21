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
  const [toast, setToast] = useState("");

  function showToast(msg, t = 2500) {
    setToast(msg);
    setTimeout(() => setToast(""), t);
  }

  useEffect(() => {
    const room = window.location.pathname.split("/")[2] || "lobby";
    setRoomId(room);

    socketRef.current = io(SIGNAL_SERVER, {
      transports: ["websocket"],
      secure: true
    });

    socketRef.current.on("connect", () => {
      const username = localStorage.user
        ? JSON.parse(localStorage.user).name
        : "Guest";

      socketRef.current.emit("join-request", { room, username });
    });

    socketRef.current.on("joined", async (payload) => {
      setParticipants(payload.members || []);
      await startLocalMedia(payload.members || []);
      showToast("You joined the room");
    });

    socketRef.current.on("members", (list) => {
      setParticipants(list || []);
    });

    socketRef.current.on("approved", async (payload) => {
      setParticipants(payload.members || []);
      await startLocalMedia(payload.members || []);
    });

    socketRef.current.on("signal", async ({ from, type, data }) => {
      if (type === "offer") handleOffer(from, data);
      if (type === "answer") {
        const pc = peersRef.current[from];
        if (pc) pc.setRemoteDescription(new RTCSessionDescription(data));
      }
      if (type === "candidate") {
        const pc = peersRef.current[from];
        if (pc) {
          try {
            pc.addIceCandidate(data);
          } catch {}
        }
      }
    });

    socketRef.current.on("user-left", ({ id }) => {
      const pc = peersRef.current[id];
      if (pc) {
        try {
          pc.close();
        } catch {}
      }
      delete peersRef.current[id];
      removeRemoteStream(id);
      setParticipants((cur) => cur.filter((p) => p.id !== id));
    });

    return () => cleanup();
  }, []);

  // 🔹 Start local camera/mic
  async function startLocalMedia(existingMembers = []) {
    if (!localStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });

        localStreamRef.current = stream;
        if (localRef.current) localRef.current.srcObject = stream;
      } catch {
        showToast("Camera/Mic permission denied");
        return;
      }
    }

    // create offers to all existing users
    for (const m of existingMembers) {
      if (m.id !== socketRef.current.id) {
        await createPeerAndOffer(m.id);
      }
    }
  }

  // 🔹 Create peer + send offer
  async function createPeerAndOffer(remoteId) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    peersRef.current[remoteId] = pc;

    localStreamRef.current.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current);
    });

    pc.ontrack = (e) => attachRemoteStream(remoteId, e.streams[0]);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current.emit("signal", {
          to: remoteId,
          type: "candidate",
          data: e.candidate
        });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socketRef.current.emit("signal", {
      to: remoteId,
      type: "offer",
      data: offer
    });
  }

  // 🔹 Respond to an offer
  async function handleOffer(from, offer) {
    let pc = peersRef.current[from];

    if (!pc) {
      pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
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
            data: e.candidate
          });
      };
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socketRef.current.emit("signal", {
      to: from,
      type: "answer",
      data: answer
    });
  }

  // 🔹 Add remote stream
  function attachRemoteStream(peerId, stream) {
    setStreams((prev) => ({ ...prev, [peerId]: stream }));

    setParticipants((prev) => {
      if (!prev.find((p) => p.id === peerId)) {
        return [...prev, { id: peerId }];
      }
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

  // 🔹 Controls
  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  };

  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  };

  const endCall = () => {
    cleanup();
    window.location.href = "/";
  };

  function cleanup() {
    try {
      socketRef.current.disconnect();
    } catch {}

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }

    for (const pc of Object.values(peersRef.current)) {
      try {
        pc.close();
      } catch {}
    }

    peersRef.current = {};
  }

  // 🔹 UI
  return (
    <div className="video-container">
      <div className="topbar">
        <div className="roomLabel">
          Gup-Shap — Room: <span className="roomId">{roomId}</span>
        </div>
        <div className="statusBadges">
          <div className="countBadge">{participants.length} participants</div>
        </div>
      </div>

      <div className="videoStage">
        <div id="remote-videos" className="remoteGrid">
          {Object.keys(streams).map((id) => (
            <VideoTile key={id} id={id} stream={streams[id]} />
          ))}
        </div>

        <div className="localFloating">
          <video ref={localRef} autoPlay muted playsInline className="localVideo" />
        </div>
      </div>

      <CallControls
        micOn={micOn}
        camOn={camOn}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
        onEndCall={endCall}
      />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
