import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import CallControls from "../components/CallControls";
import VideoTile from "../components/VideoTile";
import "../styles/videoComponent.css";
import "../styles/videoMeetCute.css";
import server from "../environment";

const getSpeakingId = (participants) => participants[0]?.id || "";

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
  const [ready, setReady] = useState(false);
  const [screenActive, setScreenActive] = useState(false);

  const [approvalRequired, setApprovalRequired] = useState(false);
  const [approved, setApproved] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);

  function showToast(msg, t = 2500) {
    setToast(msg);
    setTimeout(() => setToast(""), t);
  }

  async function startLocalMedia() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localRef.current) localRef.current.srcObject = stream;
      setMicOn(Boolean(stream.getAudioTracks()[0]?.enabled));
      setCamOn(Boolean(stream.getVideoTracks()[0]?.enabled));
    } catch (err) {
      if (err.name === "NotAllowedError") {
        showToast("Camera/Microphone permission denied");
      } else {
        showToast("Unable to access camera/microphone");
      }
      throw err;
    }
  }

  function handleToggleMic() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
      socketRef.current?.emit("media-update", {
        room: roomId,
        mic: track.enabled,
        cam: camOn,
      });
    }
  }

  function handleToggleCam() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
      socketRef.current?.emit("media-update", {
        room: roomId,
        mic: micOn,
        cam: track.enabled,
      });
    }
  }

  async function handleStartScreenShare() {
    try {
      if (screenStreamRef.current) return;
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = screenStream;
      setScreenActive(true);

      const screenTrack = screenStream.getVideoTracks()[0];
      for (const pc of Object.values(peersRef.current)) {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
        if (sender) await sender.replaceTrack(screenTrack);
      }
      if (localRef.current) localRef.current.srcObject = screenStream;
      screenTrack.onended = () => handleStopScreenShare();
    } catch (err) {
      showToast("Screen share failed");
    }
  }

  async function handleStopScreenShare() {
    if (!screenStreamRef.current) return;
    screenStreamRef.current.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setScreenActive(false);
    const camTrack = localStreamRef.current?.getVideoTracks()[0];
    for (const pc of Object.values(peersRef.current)) {
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
      if (sender && camTrack) await sender.replaceTrack(camTrack);
    }
    if (localRef.current && localStreamRef.current) localRef.current.srcObject = localStreamRef.current;
  }

  async function createPeerAndOffer(remoteId) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peersRef.current[remoteId] = pc;
    localStreamRef.current?.getTracks().forEach((track) => {
      try { pc.addTrack(track, localStreamRef.current); } catch {}
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

  // --- Auto-join meeting on mount ---
  useEffect(() => {
    if (!ready) {
      (async () => {
        await handleJoin();
      })();
    }
    // eslint-disable-next-line
  }, []);

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

    // Host flow
    socketRef.current.on("join-pending", ({ userId, username }) => {
      setPendingRequests((reqs) => [...reqs, { userId, username }]);
      setApprovalRequired(true);
    });

    socketRef.current.on("waiting-approval", ({ room }) => {
      setApprovalRequired(true);
      setApproved(false);
      showToast("Waiting for Host Approval...");
    });

    socketRef.current.on("approved", (payload) => {
      setApprovalRequired(false);
      setApproved(true);
      setParticipants(payload.members || []);
      showToast("You have been approved! Joining room...");
      for (const m of payload.members || []) {
        if (m.id !== socketRef.current.id && !peersRef.current[m.id]) {
          createPeerAndOffer(m.id);
        }
      }
    });

    socketRef.current.on("rejected", ({ room }) => {
      setApprovalRequired(false);
      setApproved(false);
      showToast("You were not approved.");
      setTimeout(() => window.location.href = "/", 2200);
    });

    socketRef.current.on("joined", async (payload) => {
      setParticipants(payload.members || []);
      if (payload.isHost) {
        setApproved(true);
        setApprovalRequired(false);
        showToast("You joined as Host");
      } else if (payload.approved) {
        setApproved(true);
        setApprovalRequired(false);
        showToast("You joined the room");
      }
      for (const m of payload.members || []) {
        if (m.id !== socketRef.current.id && !peersRef.current[m.id]) {
          await createPeerAndOffer(m.id);
        }
      }
    });

    socketRef.current.on("signal", async ({ from, type, data }) => {
      if (type === "offer") {
        let pc = peersRef.current[from];
        if (!pc) {
          pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          });
          peersRef.current[from] = pc;
          localStreamRef.current?.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));
          pc.ontrack = (e) => attachRemoteStream(from, e.streams[0]);
          pc.onicecandidate = (e) => {
            if (e.candidate) {
              socketRef.current?.emit("signal", {
                to: from,
                type: "candidate",
                data: e.candidate,
              });
            }
          };
        }
        await pc.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current.emit("signal", { to: from, type: "answer", data: answer });
      }
      if (type === "answer") {
        const pc = peersRef.current[from];
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data));
      }
      if (type === "candidate") {
        const pc = peersRef.current[from];
        if (pc) await pc.addIceCandidate(data);
      }
    });

    socketRef.current.on("members", (list) => {
      setParticipants(list || []);
    });
    socketRef.current.on("user-left", ({ id }) => {
      const pc = peersRef.current[id];
      if (pc) {
        try { pc.close(); } catch {}
      }
      delete peersRef.current[id];
      setStreams((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      setParticipants((cur) => cur.filter((p) => p.id !== id));
    });

    return () => cleanup();
    // eslint-disable-next-line
  }, [ready]);

  function attachRemoteStream(peerId, stream) {
    setStreams((prev) => ({ ...prev, [peerId]: stream }));
    setParticipants((prev) => {
      if (!prev.find((p) => p.id === peerId)) return [...prev, { id: peerId }];
      return prev;
    });
  }

  function cleanup() {
    try { socketRef.current?.disconnect(); } catch {}
    try { screenStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    try { localStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    for (const pc of Object.values(peersRef.current)) {
      try { pc.close(); } catch {}
    }
    peersRef.current = {};
    localStreamRef.current = null;
    screenStreamRef.current = null;
    setStreams({});
    setParticipants([]);
  }

  async function handleJoin() {
    try {
      await startLocalMedia();
      setReady(true);
    } catch (e) {
      console.warn("handleJoin error", e);
    }
  }

  // -------- LAYOUT LOGIC FOR SCREEN SHARE TOP + CAMERAS BOTTOM --------
  const remoteIds = Object.keys(streams);

  // Identify who (if anyone) is sharing: for now, just "local" with screenActive
  // If you want remote sharing, use a socket event sharingId = "local" or remote id.
  const sharingId = screenActive ? "local" : null;
  const hasScreenShare = !!sharingId;

  const tiles = [
    ...remoteIds
      .filter((id) => streams[id])
      .map((id) => ({
        id,
        stream: streams[id],
        username: participants.find((p) => p.id === id)?.username || id,
        sharing: sharingId === id,
      })),
    localStreamRef.current
      ? {
          id: "local",
          stream: localStreamRef.current,
          username: "You",
          sharing: sharingId === "local",
        }
      : null,
  ].filter(Boolean);

  const cameraTiles = tiles.filter((tile) => !tile.sharing);
  const screenTile = tiles.find((tile) => tile.sharing) || null;
  const isSingle = tiles.length === 1;

  useEffect(() => {
    setScreenActive(Boolean(screenStreamRef.current));
  }, [screenStreamRef.current]);

  const speakingId = getSpeakingId(participants);

  function handleApprove(userId) {
    socketRef.current.emit("approve-join", { room: roomId, userId });
    setPendingRequests((reqs) => reqs.filter((r) => r.userId !== userId));
    if (pendingRequests.length === 1) setApprovalRequired(false);
  }

  function handleReject(userId) {
    socketRef.current.emit("reject-join", { room: roomId, userId });
    setPendingRequests((reqs) => reqs.filter((r) => r.userId !== userId));
    if (pendingRequests.length === 1) setApprovalRequired(false);
  }

  if (approvalRequired && !approved && pendingRequests.length === 0) {
    return (
      <div className="meet-cute-bg meet-center">
        <div className="waiting-approval-popup">
          <div style={{ fontSize: 20, marginBottom: 30 }}>
            Waiting for Host Approval...
          </div>
          <div className="spinner" />
        </div>
        {toast && <div style={{ marginTop: 20, color: "red" }}>{toast}</div>}
      </div>
    );
  }

  if (approvalRequired && pendingRequests.length > 0) {
    return (
      <div className="meet-cute-bg meet-center">
        <div className="approval-popup">
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 18 }}>
            Approve guests to join your call:
          </div>
          {pendingRequests.map((req) => (
            <div
              key={req.userId}
              style={{
                background: "#fcf8ff",
                padding: "18px 22px",
                borderRadius: "18px",
                marginBottom: "18px",
                boxShadow: "0 2px 14px 0px #eecdf3",
              }}
            >
              <span style={{ fontWeight: 600 }}>
                {req.username || req.userId}
              </span>
              <button
                className="meet-cute-btn"
                style={{ marginLeft: 20 }}
                onClick={() => handleApprove(req.userId)}
              >
                Approve
              </button>
              <button
                style={{
                  marginLeft: 6,
                  background: "#ffebee",
                  color: "#db2462",
                  borderRadius: "13px",
                  padding: "8px 16px",
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() => handleReject(req.userId)}
              >
                Reject
              </button>
            </div>
          ))}
        </div>
        {toast && <div style={{ marginTop: 20, color: "red" }}>{toast}</div>}
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="meet-cute-bg meet-center">
        <div className="spinner" />
        <div style={{ marginTop: 18, fontWeight: 600, color: "#437dda" }}>
          Setting up your camera and mic...
        </div>
      </div>
    );
  }

  return (
    <div className="meet-cute-bg meet-page-cute">
      <div className="topbar">
        <div className="roomLabel">
          Gup-Shap — Room: <span className="roomId">{roomId}</span>
        </div>
        <div className="countBadge">
          {participants.length} participants
        </div>
      </div>
      <div className={`videoStageCute ${isSingle ? "singleStage" : ""}`}>
        {/* SCREEN SHARE LAYOUT */}
        {hasScreenShare ? (
          <>
            <div className="screenShareRow" style={{ width: "100%", display: "flex", justifyContent: "center" }}>
              {/* Big screen share tile */}
              <VideoTile
                key={screenTile.id}
                id={screenTile.id}
                username={screenTile.username}
                stream={screenTile.stream}
                active={screenTile.id === speakingId}
                sharing={true}
                pinned={false}
              />
            </div>
            <div className="cameraRow" style={{
              width: "100%",
              display: "flex",
              justifyContent: "center",
              gap: 30,
              marginTop: 30
            }}>
              {cameraTiles.map((tile) => (
                <VideoTile
                  key={tile.id}
                  id={tile.id}
                  username={tile.username}
                  stream={tile.stream}
                  active={tile.id === speakingId}
                  sharing={false}
                  pinned={false}
                />
              ))}
            </div>
          </>
        ) : (
          // Regular responsive grid when NOT sharing
          <div className={`videoGridCute${screenActive ? " presentingStage" : ""}`}>
            {tiles.map((tile) => (
              <VideoTile
                key={tile.id}
                id={tile.id}
                username={tile.username}
                stream={tile.stream}
                active={tile.id === speakingId}
                sharing={tile.sharing}
                pinned={false}
              />
            ))}
          </div>
        )}
      </div>
      <CallControls
        micOn={micOn}
        camOn={camOn}
        onToggleMic={handleToggleMic}
        onToggleCam={handleToggleCam}
        onEndCall={() => (window.location.href = "/")}
        onStartScreenShare={handleStartScreenShare}
        onStopScreenShare={handleStopScreenShare}
        isSharingScreen={screenActive}
      />
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
