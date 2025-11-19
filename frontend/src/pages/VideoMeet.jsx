// frontend/src/pages/VideoMeet.jsx
import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useParams, useNavigate } from "react-router-dom";

/*
  Full VideoMeet component:
  - Uses socket.io to talk to your backend signaling server
  - Handles lobby/approve flow (host approves pending users)
  - Renders remote videos using React state (no manual DOM mutating)
  - Single local video (no duplicate floating video bug)
  - Mic/Cam toggles send "media-update" to server so participants see state
  - Plays a small ring audio hosted online (no local mp3 required)
*/

const SIGNAL_SERVER = "https://gup-shapbackend.onrender.com"; // adjust if needed
const RING_AUDIO_URL = "https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg"; // safe hosted ring

export default function VideoMeet() {
  const { roomId: paramRoom } = useParams();
  const navigate = useNavigate();

  const localVideoRef = useRef(null);
  const socketRef = useRef(null);
  const pcsRef = useRef({}); // peerId -> RTCPeerConnection
  const localStreamRef = useRef(null);

  const [roomId] = useState(paramRoom || "lobby");
  const [participants, setParticipants] = useState([]); // list { id, username, mic, cam }
  const [pending, setPending] = useState([]); // for host
  const [isHost, setIsHost] = useState(false);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const ringRef = useRef(null);

  // map remote streams by id -> MediaStream
  const [remoteStreams, setRemoteStreams] = useState({});

  useEffect(() => {
    // connect socket
    socketRef.current = io(SIGNAL_SERVER, { transports: ["websocket"] });

    socketRef.current.on("connect", () => {
      const username = localStorage?.user ? JSON.parse(localStorage.user).name : "Guest";
      socketRef.current.emit("join-request", { room: roomId, username });
    });

    socketRef.current.on("joined", async (payload) => {
      setIsHost(Boolean(payload.isHost));
      setParticipants(payload.members || []);
      await startLocal();
    });

    socketRef.current.on("approved", async (payload) => {
      // we were approved (for pending)
      setParticipants(payload.members || []);
      await startLocal();
    });

    socketRef.current.on("members", (m) => {
      setParticipants(m || []);
    });

    socketRef.current.on("lobby-request", (req) => {
      // host gets a pending request
      setPending(prev => {
        const exists = prev.find(x => x.id === req.id);
        if (exists) return prev;
        return [...prev, req];
      });
    });

    socketRef.current.on("user-joined", ({ id, username }) => {
      // play ring and refresh members (server should emit members)
      playRing();
      socketRef.current.emit("get-members", { room: roomId });
    });

    socketRef.current.on("user-left", ({ id }) => {
      // cleanup peer and stream
      removePeer(id);
    });

    socketRef.current.on("signal", async ({ from, type, data }) => {
      // handle signaling
      if (type === "offer") {
        await handleOffer(from, data);
      } else if (type === "answer") {
        const pc = pcsRef.current[from];
        if (pc && data) await pc.setRemoteDescription(new RTCSessionDescription(data));
      } else if (type === "candidate") {
        const pc = pcsRef.current[from];
        if (pc && data) {
          try { await pc.addIceCandidate(data); } catch (e) { console.warn("candidate add failed", e); }
        }
      }
    });

    socketRef.current.on("raise-hand", ({ from, username }) => {
      // simple toast using alert for now (you can replace with nicer UI)
      if (!isHost && from !== socketRef.current.id) {
        // anyone can see raise-hand toast
        console.info(`${username || from} raised their hand`);
      }
    });

    // cleanup on unmount
    return () => {
      cleanupEverything();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // start local media (camera + mic)
  const startLocal = async () => {
    if (localStreamRef.current) return;

    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: camOn, audio: micOn });
      localStreamRef.current = s;
      if (localVideoRef.current) localVideoRef.current.srcObject = s;

      // once we have local stream, create offers for existing participants
      // request current members list (server should have emitted 'members' earlier)
      socketRef.current.emit("get-members", { room: roomId });
    } catch (e) {
      console.error("getUserMedia failed", e);
      alert("Camera / microphone access is required for calls.");
    }
  };

  // create peer connection and offer to remoteId
  const createAndOffer = async (remoteId) => {
    if (!localStreamRef.current) await startLocal();

    if (pcsRef.current[remoteId]) return;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

    // add local tracks
    localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));

    pc.onicecandidate = (e) => {
      if (e.candidate) socketRef.current.emit("signal", { to: remoteId, type: "candidate", data: e.candidate });
    };

    pc.ontrack = (e) => {
      // remote stream received
      setRemoteStreams(prev => ({ ...prev, [remoteId]: e.streams[0] }));
    };

    pcsRef.current[remoteId] = pc;

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current.emit("signal", { to: remoteId, type: "offer", data: offer });
    } catch (err) {
      console.error("create offer error", err);
    }
  };

  // handle incoming offer, reply with answer
  const handleOffer = async (from, offer) => {
    if (!localStreamRef.current) await startLocal();

    let pc = pcsRef.current[from];
    if (!pc) {
      pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

      localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));

      pc.onicecandidate = (e) => {
        if (e.candidate) socketRef.current.emit("signal", { to: from, type: "candidate", data: e.candidate });
      };

      pc.ontrack = (e) => {
        setRemoteStreams(prev => ({ ...prev, [from]: e.streams[0] }));
      };

      pcsRef.current[from] = pc;
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socketRef.current.emit("signal", { to: from, type: "answer", data: answer });
  };

  // when participants state updates, create offers to newly joined users (if we are already active)
  useEffect(() => {
    if (!socketRef.current || !localStreamRef.current) return;

    const meId = socketRef.current.id;
    participants.forEach(m => {
      if (m.id === meId) return;
      // if no pc yet, create and offer
      if (!pcsRef.current[m.id]) createAndOffer(m.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants]);

  // remove a peer and its stream
  const removePeer = (peerId) => {
    if (pcsRef.current[peerId]) {
      try { pcsRef.current[peerId].close(); } catch (e) {}
      delete pcsRef.current[peerId];
    }
    setRemoteStreams(prev => {
      const copy = { ...prev };
      delete copy[peerId];
      return copy;
    });
    setParticipants(prev => prev.filter(p => p.id !== peerId));
    setPending(prev => prev.filter(x => x.id !== peerId));
  };

  // cleanup everything on leave/unmount
  const cleanupEverything = () => {
    try { socketRef.current?.disconnect(); } catch (e) {}
    try {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    } catch (e) {}
    Object.values(pcsRef.current).forEach(pc => { try { pc.close(); } catch (e) {} });
    pcsRef.current = {};
    localStreamRef.current = null;
    setRemoteStreams({});
    setParticipants([]);
    setPending([]);
  };

  // toggle mic and notify server
  const toggleMic = () => {
    if (!localStreamRef.current) return;
    const tracks = localStreamRef.current.getAudioTracks();
    if (!tracks.length) return;
    tracks.forEach(t => t.enabled = !t.enabled);
    const enabled = tracks[0].enabled;
    setMicOn(enabled);
    socketRef.current.emit("media-update", { room: roomId, mic: enabled, cam: camOn });
  };

  // toggle camera and notify server
  const toggleCam = () => {
    if (!localStreamRef.current) return;
    const tracks = localStreamRef.current.getVideoTracks();
    if (!tracks.length) return;
    tracks.forEach(t => t.enabled = !t.enabled);
    const enabled = tracks[0].enabled;
    setCamOn(enabled);
    socketRef.current.emit("media-update", { room: roomId, mic: micOn, cam: enabled });
  };

  // start screen share and replace track on all peer connections
  const startScreenShare = async () => {
    if (!localStreamRef.current) return;
    try {
      const disp = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = disp.getVideoTracks()[0];
      Object.values(pcsRef.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === "video");
        if (sender) sender.replaceTrack(screenTrack);
      });
      // set local preview
      if (localVideoRef.current) localVideoRef.current.srcObject = disp;
      setSharing(true);
      screenTrack.onended = () => {
        // restore camera
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
        Object.values(pcsRef.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track && s.track.kind === "video");
          if (sender) sender.replaceTrack(localStreamRef.current.getVideoTracks()[0]);
        });
        setSharing(false);
      };
    } catch (e) {
      console.error("Screen share failed", e);
      alert("Screen share failed");
    }
  };

  // end call (cleanup and navigate home)
  const endCall = () => {
    cleanupEverything();
    navigate("/");
  };

  // host approves a pending user
  const approve = (userId) => {
    setPending(prev => prev.filter(x => x.id !== userId));
    socketRef.current.emit("approve-join", { room: roomId, userId });
  };

  // raise hand
  const raiseHand = () => {
    socketRef.current.emit("raise-hand", { room: roomId, raised: true });
    alert("You raised your hand");
  };

  // play ring audio (external hosted file)
  const playRing = () => {
    try {
      if (!ringRef.current) {
        ringRef.current = new Audio(RING_AUDIO_URL);
        ringRef.current.volume = 0.6;
      }
      ringRef.current.play().catch(() => {});
    } catch (e) { /* ignore */ }
  };

  // render video element for a remote id
  const RemoteVideo = ({ id, stream, username }) => {
    const ref = useRef(null);

    useEffect(() => {
      if (ref.current && stream) {
        try {
          ref.current.srcObject = stream;
        } catch (e) {
          ref.current.src = URL.createObjectURL(stream);
        }
      }
      return () => {
        if (ref.current) {
          try { ref.current.srcObject = null; } catch (e) {}
        }
      };
    }, [stream]);

    return (
      <div style={{
        width: 360, height: 260, background: "#000", borderRadius: 10, overflow: "hidden",
        display: "flex", flexDirection: "column", alignItems: "center"
      }}>
        <video ref={ref} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ padding: 6, background: "rgba(0,0,0,0.4)", color: "#fff", fontSize: 12, width: "100%", textAlign: "center" }}>
          {username || id}
        </div>
      </div>
    );
  };

  // UI layout
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#051022,#071626)", color: "#fff", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Gup-Shap — Room: <span style={{ color: "#6cb4ff" }}>{roomId}</span></h3>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {isHost && <div style={{ padding: "6px 10px", background: "#0b5c2f", borderRadius: 6 }}>Host</div>}
          <div style={{ padding: "6px 10px", background: "#14232b", borderRadius: 6 }}>{participants.length} participants</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 18 }}>
        {/* left: remote grid */}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            {/* remote videos (exclude self) */}
            {Object.entries(remoteStreams).length === 0 && (
              <div style={{
                width: "100%", height: 280, borderRadius: 12, background: "#07111a", display: "flex",
                alignItems: "center", justifyContent: "center", color: "#9fb2c7"
              }}>
                Waiting for others to join...
              </div>
            )}

            {Object.entries(remoteStreams).map(([id, stream]) => {
              const p = participants.find(x => x.id === id) || {};
              return (
                <RemoteVideo key={id} id={id} stream={stream} username={p.username} />
              );
            })}
          </div>
        </div>

        {/* right: local preview + host pending list */}
        <div style={{ width: 360 }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ background: "#071422", borderRadius: 10, padding: 8 }}>
              <video ref={localVideoRef} autoPlay muted playsInline style={{ width: "100%", height: 220, objectFit: "cover", borderRadius: 6 }} />
              <div style={{ marginTop: 8, fontSize: 13, color: "#cce8ff" }}>
                {localStorage?.user ? JSON.parse(localStorage.user).name : "You"}
              </div>
            </div>
          </div>

          {isHost && pending.length > 0 && (
            <div style={{ marginTop: 14, background: "#071422", padding: 10, borderRadius: 8 }}>
              <div style={{ color: "#9fb2c7", marginBottom: 8 }}>Pending approvals (click to approve)</div>
              {pending.map(req => (
                <div key={req.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ color: "#fff" }}>{req.username || req.id}</div>
                  <button onClick={() => approve(req.id)} style={{ background: "#1b7bff", border: "none", padding: "6px 10px", borderRadius: 6, color: "#fff" }}>
                    Approve
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* bottom controls */}
      <div style={{
        position: "fixed", left: "50%", transform: "translateX(-50%)",
        bottom: 20, background: "rgba(7,16,24,0.8)", padding: 12, borderRadius: 12, display: "flex", gap: 12
      }}>
        <button onClick={toggleMic} style={controlBtnStyle}>{micOn ? "Mute" : "Unmute"}</button>
        <button onClick={toggleCam} style={controlBtnStyle}>{camOn ? "Camera Off" : "Camera On"}</button>
        <button onClick={startScreenShare} style={controlBtnStyle}>Share Screen</button>
        <button onClick={raiseHand} style={{ ...controlBtnStyle, background: "#2f8a2f" }}>Raise Hand</button>
        <button onClick={endCall} style={{ ...controlBtnStyle, background: "#ff5b5b" }}>End Call</button>
      </div>
    </div>
  );
}

// simple button style
const controlBtnStyle = {
  border: "none",
  padding: "10px 14px",
  borderRadius: 8,
  background: "#142a3a",
  color: "#eaf6ff",
  cursor: "pointer",
  fontWeight: 600
};
