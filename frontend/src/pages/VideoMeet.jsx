// frontend/src/pages/VideoMeet.jsx
import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import CallControls from "../components/CallControls";
import VideoTile from "../components/VideoTile";
import "../styles/videoComponent.css";
import "../styles/videoMeetOverrides.css";
import server from "../environment"; // <--- use environment so build-time env var is used

export default function VideoMeet() {
  const localRef = useRef();
  const peersRef = useRef({});
  const socketRef = useRef();
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

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

    // 1) Start local media immediately so browser asks permission
    // This ensures the user sees a camera prompt even if socket fails
    startLocalMedia().catch((e) => {
      // don't block initialization if permission denied
      console.warn("Local media start failed on mount:", e);
    });

    // 2) Connect socket: prefer websocket but allow polling fallback.
    // Use `server` from environment so the correct deployed URL is used.
    socketRef.current = io(server, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      secure: true,
      autoConnect: true,
    });

    socketRef.current.on("connect", () => {
      console.log("socket connected", socketRef.current.id);
      const username = localStorage.user
        ? JSON.parse(localStorage.user).name
        : "Guest";
      socketRef.current.emit("join-request", { room, username });
    });

    socketRef.current.on("connect_error", (err) => {
      console.error("socket connect_error", err);
      showToast("Socket connection error");
    });

    socketRef.current.on("joined", async (payload) => {
      setParticipants(payload.members || []);
      // create offers to existing members (if not already)
      for (const m of payload.members || []) {
        if (m.id !== socketRef.current.id && !peersRef.current[m.id]) {
          await createPeerAndOffer(m.id);
        }
      }
      showToast("You joined the room");
    });

    socketRef.current.on("members", (list) => {
      setParticipants(list || []);
    });

    socketRef.current.on("approved", async (payload) => {
      setParticipants(payload.members || []);
      // create offers to existing members (if not already)
      for (const m of payload.members || []) {
        if (m.id !== socketRef.current.id && !peersRef.current[m.id]) {
          await createPeerAndOffer(m.id);
        }
      }
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
            await pc.addIceCandidate(data);
          } catch (err) {
            console.warn("addIceCandidate failed", err);
          }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------
  // Media & Peer functions
  // -----------------------------
  async function startLocalMedia(existingMembers = []) {
    if (!localStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = stream;
        if (localRef.current) localRef.current.srcObject = stream;
        setMicOn(Boolean(stream.getAudioTracks()[0]?.enabled));
        setCamOn(Boolean(stream.getVideoTracks()[0]?.enabled));
      } catch (err) {
        console.warn("getUserMedia error:", err);
        showToast("Camera/Mic permission denied");
        return;
      }
    }

    // If existingMembers provided (e.g. from server), create offers
    for (const m of existingMembers) {
      if (m.id !== socketRef.current.id && !peersRef.current[m.id]) {
        await createPeerAndOffer(m.id);
      }
    }
  }

  async function createPeerAndOffer(remoteId) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peersRef.current[remoteId] = pc;

    // add all tracks from local stream
    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current);
    });

    pc.ontrack = (e) => attachRemoteStream(remoteId, e.streams[0]);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current?.emit("signal", {
          to: remoteId,
          type: "candidate",
          data: e.candidate,
        });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socketRef.current?.emit("signal", {
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

      // ensure local media is available
      if (!localStreamRef.current) {
        await startLocalMedia();
      }

      localStreamRef.current?.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current));

      pc.ontrack = (e) => attachRemoteStream(from, e.streams[0]);

      pc.onicecandidate = (e) => {
        if (e.candidate)
          socketRef.current?.emit("signal", {
            to: from,
            type: "candidate",
            data: e.candidate,
          });
      };
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socketRef.current?.emit("signal", {
      to: from,
      type: "answer",
      data: answer,
    });
  }

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

  // -----------------------------
  // Controls
  // -----------------------------
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

  // Screen share: replaces outgoing video track on all peer connections
  const startScreenShare = async () => {
    try {
      if (screenStreamRef.current) return; // already sharing
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = screen;

      // replace outgoing video track on each RTCPeerConnection
      const screenTrack = screen.getVideoTracks()[0];
      for (const [peerId, pc] of Object.entries(peersRef.current)) {
        try {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
          if (sender) await sender.replaceTrack(screenTrack);
        } catch (err) {
          console.warn("replaceTrack error for peer", peerId, err);
        }
      }

      // show screen locally
      if (localRef.current) localRef.current.srcObject = screen;

      // when user stops sharing, restore camera
      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.warn("screen share error", err);
      showToast("Screen share failed");
    }
  };

  const stopScreenShare = async () => {
    if (!screenStreamRef.current) return;

    // stop display stream tracks
    screenStreamRef.current.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;

    // restore camera track to all peers
    const camTrack = localStreamRef.current?.getVideoTracks()[0];
    for (const [peerId, pc] of Object.entries(peersRef.current)) {
      try {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
        if (sender && camTrack) await sender.replaceTrack(camTrack);
      } catch (err) {
        console.warn("replaceTrack restore error", peerId, err);
      }
    }

    // restore local video element to camera stream
    if (localRef.current && localStreamRef.current) {
      localRef.current.srcObject = localStreamRef.current;
    }
  };

  const endCall = () => {
    cleanup();
    window.location.href = "/";
  };

  function cleanup() {
    try {
      socketRef.current?.disconnect();
    } catch {}

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    for (const pc of Object.values(peersRef.current)) {
      try {
        pc.close();
      } catch {}
    }

    peersRef.current = {};
    setStreams({});
    setParticipants([]);
  }

  // -----------------------------
  // UI
  // -----------------------------
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
        // if your CallControls accepts handlers for screen share:
        onStartScreenShare={startScreenShare}
        onStopScreenShare={stopScreenShare}
      />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
