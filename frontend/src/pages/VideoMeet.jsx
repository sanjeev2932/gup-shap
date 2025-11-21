// frontend/src/pages/VideoMeet.jsx
import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import CallControls from "../components/CallControls";
import VideoTile from "../components/VideoTile";
import "../styles/videoComponent.css";
import "../styles/videoMeetOverrides.css";
import server from "../environment";

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
  const [ready, setReady] = useState(false); // 🔥 NEW

  function showToast(msg, t = 2500) {
    setToast(msg);
    setTimeout(() => setToast(""), t);
  }

  async function handleJoin() {
    try {
      await startLocalMedia();
      setReady(true);
    } catch (e) {
      console.warn("handleJoin error", e);
    }
  }

  useEffect(() => {
    if (!ready) return;

    const room = window.location.pathname.split("/")[2] || "lobby";
    setRoomId(room);

    socketRef.current = io(server, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      secure: true,
      autoConnect: true,
    });

    socketRef.current.on("connect", () => {
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
      for (const m of payload.members || []) {
        if (m.id !== socketRef.current.id && !peersRef.current[m.id]) {
          await createPeerAndOffer(m.id);
        }
      }
    });

    socketRef.current.on("signal", async ({ from, type, data }) => {
      if (type === "offer") await handleOffer(from, data);
      if (type === "answer") {
        const pc = peersRef.current[from];
        if (pc) {
          try {
            await pc.setRemoteDescription(
              new RTCSessionDescription(data)
            );
          } catch (err) {
            console.warn("setRemoteDescription answer error", err);
          }
        }
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
  }, [ready]);

  // Start camera/mic 
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
        if (err.name === "NotAllowedError") {
          showToast("Camera/Microphone permission denied");
        } else {
          showToast("Unable to access camera/microphone");
        }
        throw err;
      }
    }
  }

  async function createPeerAndOffer(remoteId) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peersRef.current[remoteId] = pc;

    localStreamRef.current?.getTracks().forEach((track) => {
      try {
        pc.addTrack(track, localStreamRef.current);
      } catch (err) {
        console.warn("pc.addTrack failed", err);
      }
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

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.emit("signal", {
        to: remoteId,
        type: "offer",
        data: offer,
      });
    } catch (err) {
      console.warn("createPeerAndOffer error", err);
    }
  }

  async function handleOffer(from, offer) {
    let pc = peersRef.current[from];

    if (!pc) {
      pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      peersRef.current[from] = pc;

      if (!localStreamRef.current) await startLocalMedia();

      localStreamRef.current?.getTracks().forEach((t) => {
        try {
          pc.addTrack(t, localStreamRef.current);
        } catch (err) {
          console.warn("pc.addTrack inside handleOffer failed", err);
        }
      });

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

    try {
      await pc.setRemoteDescription(
        new RTCSessionDescription(offer)
      );
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current?.emit("signal", {
        to: from,
        type: "answer",
        data: answer,
      });
    } catch (err) {
      console.warn("handleOffer error", err);
    }
  }

  function attachRemoteStream(peerId, stream) {
    setStreams((prev) => ({ ...prev, [peerId]: stream }));
    setParticipants((prev) => {
      if (!prev.find((p) => p.id === peerId))
        return [...prev, { id: peerId }];
      return prev;
    });
  }

  function removeRemoteStream(peerId) {
    setStreams((prev) => {
      const copy = { ...prev };
      delete copy[peerId];
      return copy;
    });
  }

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

  const startScreenShare = async () => {
    try {
      if (screenStreamRef.current) return;
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      screenStreamRef.current = screen;
      const screenTrack = screen.getVideoTracks()[0];

      for (const pc of Object.values(peersRef.current)) {
        try {
          const sender = pc
            .getSenders()
            .find((s) => s.track && s.track.kind === "video");
          if (sender) await sender.replaceTrack(screenTrack);
        } catch (err) {
          console.warn("replaceTrack error", err);
        }
      }

      if (localRef.current) localRef.current.srcObject = screen;

      screenTrack.onended = () => stopScreenShare();
    } catch (err) {
      console.warn("startScreenShare error", err);
      showToast("Screen share failed or cancelled");
    }
  };

  const stopScreenShare = async () => {
    if (!screenStreamRef.current) return;

    try {
      screenStreamRef.current
        .getTracks()
        .forEach((t) => t.stop());
    } catch {}

    screenStreamRef.current = null;

    const camTrack =
      localStreamRef.current?.getVideoTracks()[0];

    for (const pc of Object.values(peersRef.current)) {
      try {
        const sender = pc
          .getSenders()
          .find((s) => s.track && s.track.kind === "video");
        if (sender && camTrack)
          await sender.replaceTrack(camTrack);
      } catch (err) {
        console.warn("replaceTrack restore error", err);
      }
    }

    if (localRef.current && localStreamRef.current)
      localRef.current.srcObject = localStreamRef.current;
  };

  const endCall = () => {
    cleanup();
    window.location.href = "/";
  };

  function cleanup() {
    try {
      socketRef.current?.disconnect();
    } catch {}

    try {
      screenStreamRef.current
        ?.getTracks()
        .forEach((t) => t.stop());
    } catch {}

    try {
      localStreamRef.current
        ?.getTracks()
        .forEach((t) => t.stop());
    } catch {}

    for (const pc of Object.values(peersRef.current)) {
      try {
        pc.close();
      } catch {}
    }

    peersRef.current = {};
    localStreamRef.current = null;
    screenStreamRef.current = null;
    setStreams({});
    setParticipants([]);
  }

  // 🔥 PRE-JOIN SCREEN
  if (!ready) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: "22px",
          flexDirection: "column",
        }}
      >
        <button
          onClick={handleJoin}
          style={{
            padding: "12px 24px",
            fontSize: "20px",
            borderRadius: "10px",
            cursor: "pointer",
            background: "#4f46e5",
            color: "white",
            border: "none",
          }}
        >
          Join Call
        </button>

        {toast && (
          <div style={{ marginTop: "20px", color: "red" }}>
            {toast}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="video-container">
      <div className="topbar">
        <div className="roomLabel">
          Gup-Shap — Room:{" "}
          <span className="roomId">{roomId}</span>
        </div>
        <div className="statusBadges">
          <div className="countBadge">
            {participants.length} participants
          </div>
        </div>
      </div>

      <div className="videoStage">
        <div
          id="remote-videos"
          className="remoteGrid"
        >
          {Object.keys(streams).map((id) => (
            <VideoTile
              key={id}
              id={id}
              stream={streams[id]}
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
        </div>
      </div>

      <CallControls
        micOn={micOn}
        camOn={camOn}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
        onEndCall={endCall}
        onStartScreenShare={startScreenShare}
        onStopScreenShare={stopScreenShare}
      />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
