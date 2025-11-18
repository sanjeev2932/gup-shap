import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { Badge, IconButton, TextField, Button } from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from "@mui/icons-material/Chat";
import styles from "../styles/videoComponent.module.css";
import "../pages/videoMeetOverrides.css";
import server from "../environment";

const server_url = server;
const peerConfigConnections = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

let connections = {}; // RTCPeerConnection objects keyed by remote socketId

export default function VideoMeetComponent() {
  const socketRef = useRef(null);
  const socketIdRef = useRef(null);
  const localVideoRef = useRef(null);
  const videoRefs = useRef({}); // refs for remote videos

  const [localStream, setLocalStream] = useState(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [chatOpen, setChatOpen] = useState(true);
  const [username, setUsername] = useState("");
  const [inLobby, setInLobby] = useState(true);
  const [remoteVideos, setRemoteVideos] = useState([]); // { socketId, stream, displayName? }

  // request camera/mic only once when user clicks connect
  const requestMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoEnabled,
        audio: audioEnabled,
      });
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch (err) {
      console.error("getUserMedia error:", err);
      alert("Please allow camera/microphone access in your browser.");
      throw err;
    }
  };

  // helper: create / configure a new RTCPeerConnection for a given remote socket id
  const preparePeerConnection = (remoteSocketId) => {
    const pc = new RTCPeerConnection(peerConfigConnections);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        try {
          socketRef.current.emit(
            "signal",
            remoteSocketId,
            JSON.stringify({ ice: event.candidate })
          );
        } catch (e) {
          console.warn("emit ice failed", e);
        }
      }
    };

    pc.ontrack = (event) => {
      // when remote tracks arrive, attach to video element for remoteSocketId
      const streams = event.streams;
      const stream = streams && streams[0];
      if (!stream) return;

      setRemoteVideos((prev) => {
        // update if exists
        const found = prev.find((v) => v.socketId === remoteSocketId);
        if (found) {
          return prev.map((v) =>
            v.socketId === remoteSocketId ? { ...v, stream } : v
          );
        } else {
          return [...prev, { socketId: remoteSocketId, stream }];
        }
      });
    };

    return pc;
  };

  // called when we receive an SDP or ICE from server
  const gotServerMessage = async (fromId, msg) => {
    try {
      const signal = JSON.parse(msg);
      if (fromId === socketIdRef.current) return;

      // ensure connection object exists
      if (!connections[fromId]) {
        connections[fromId] = preparePeerConnection(fromId);

        // add local tracks if we have them
        if (localStream) {
          localStream.getTracks().forEach((t) => connections[fromId].addTrack(t, localStream));
        } else {
          // start silent tracks so other peers don't break (optional)
        }
      }

      const pc = connections[fromId];

      if (signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        if (signal.sdp.type === "offer") {
          const desc = await pc.createAnswer();
          await pc.setLocalDescription(desc);
          socketRef.current.emit("signal", fromId, JSON.stringify({ sdp: pc.localDescription }));
        }
      } else if (signal.ice) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.ice));
        } catch (e) {
          console.warn("addIceCandidate failed", e);
        }
      }
    } catch (e) {
      console.error("gotServerMessage err", e);
    }
  };

  // connect socket and join room
  const connectToSocketServer = (url) => {
    socketRef.current = io.connect(server_url, { transports: ["websocket"], secure: false });
    socketRef.current.on("connect", () => {
      socketIdRef.current = socketRef.current.id;
      socketRef.current.emit("join-call", url);
    });

    socketRef.current.on("signal", gotServerMessage);

    socketRef.current.on("user-joined", async (id, clients) => {
      // when server tells us user-joined, make pc entries for everyone and if it's us, create offers
      clients.forEach((socketListId) => {
        if (!connections[socketListId]) {
          connections[socketListId] = preparePeerConnection(socketListId);
          // add local tracks
          if (localStream) {
            localStream.getTracks().forEach((t) => connections[socketListId].addTrack(t, localStream));
          }
        }
      });

      // if the server emitted that this event is for me (I joined), create offers to others
      if (id === socketIdRef.current) {
        for (const id2 of Object.keys(connections)) {
          if (id2 === socketIdRef.current) continue;
          try {
            const pc = connections[id2];
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketRef.current.emit("signal", id2, JSON.stringify({ sdp: pc.localDescription }));
          } catch (e) {
            console.warn("createOffer failed", e);
          }
        }
      }
    });

    socketRef.current.on("chat-message", (data, sender, socketIdSender) => {
      setMessages((prev) => [...prev, { sender, data }]);
      if (socketIdSender !== socketIdRef.current) {
        setNewMessagesCount((n) => n + 1);
      }
    });

    socketRef.current.on("user-left", (id) => {
      // remove from remoteVideos and close connection
      setRemoteVideos((prev) => prev.filter((v) => v.socketId !== id));
      if (connections[id]) {
        try {
          connections[id].close();
        } catch (e) {}
        delete connections[id];
      }
    });
  };

  // join: called when user provides username and clicks connect
  const handleJoin = async () => {
    if (!username || username.trim() === "") {
      alert("Please enter a username to join");
      return;
    }

    try {
      // request media
      const stream = await requestMedia();
      setInLobby(false);
      setLocalStream(stream);

      // attach to local video element
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      // connect socket and join room (using url path)
      connectToSocketServer(window.location.href);
    } catch (e) {
      // already alerted in requestMedia
    }
  };

  // stop and cleanup local stream and peers
  const leaveCall = () => {
    // stop local tracks
    if (localStream) {
      localStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (e) {}
      });
    }
    setLocalStream(null);

    // close peers
    for (const id in connections) {
      try {
        connections[id].close();
      } catch (e) {}
      delete connections[id];
    }

    // tell server and disconnect socket
    try {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    } catch (e) {}

    setRemoteVideos([]);
    setInLobby(true);
    // optionally navigate back to landing page:
    // window.location.href = "/";
  };

  // toggle local video track enabled/disabled
  const toggleVideo = () => {
    if (!localStream) return;
    localStream.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setVideoEnabled((v) => !v);
  };

  // toggle audio
  const toggleAudio = () => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setAudioEnabled((a) => !a);
  };

  // start/stop screen share
  const toggleScreenShare = async () => {
    if (!screenSharing) {
      if (!navigator.mediaDevices.getDisplayMedia) {
        alert("Screen sharing is not available on this browser.");
        return;
      }
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        // replace video track in each peer connection
        const screenTrack = screenStream.getVideoTracks()[0];
        for (const id in connections) {
          const senders = connections[id].getSenders();
          const videoSender = senders.find((s) => s.track && s.track.kind === "video");
          if (videoSender) await videoSender.replaceTrack(screenTrack);
        }
        // set local preview to screen
        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
        // when screen sharing stops, restore camera
        screenTrack.onended = async () => {
          if (localStream) {
            if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
            for (const id in connections) {
              const senders = connections[id].getSenders();
              const videoSender = senders.find((s) => s.track && s.track.kind === "video");
              if (videoSender) {
                // replace with original camera track
                const camTrack = localStream.getVideoTracks()[0];
                if (camTrack) await videoSender.replaceTrack(camTrack);
              }
            }
          }
          setScreenSharing(false);
        };
        setScreenSharing(true);
      } catch (e) {
        console.error("screen share error", e);
      }
    } else {
      // if currently screen sharing, stop all display tracks (onended callback will restore)
      if (localVideoRef.current && localVideoRef.current.srcObject) {
        try {
          localVideoRef.current.srcObject.getTracks().forEach((t) => {
            if (t.kind === "video" && t.label.includes("screen")) t.stop();
          });
        } catch (e) {}
      }
      setScreenSharing(false);
    }
  };

  // send a chat message
  const sendMessage = () => {
    if (!messageText || messageText.trim() === "") return;
    if (socketRef.current) {
      socketRef.current.emit("chat-message", messageText, username || "Guest");
      setMessages((prev) => [...prev, { sender: username || "You", data: messageText }]);
      setMessageText("");
    }
  };

  // cleanup when component unmounts
  useEffect(() => {
    return () => {
      leaveCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // when remoteVideos change, attach their stream to a video element via refs
  useEffect(() => {
    remoteVideos.forEach((rv) => {
      if (!videoRefs.current[rv.socketId]) {
        // create element ref container (we use DOM assignment in JSX)
        videoRefs.current[rv.socketId] = React.createRef();
      }
      const ref = videoRefs.current[rv.socketId];
      if (ref && ref.current) {
        ref.current.srcObject = rv.stream;
      }
    });
  }, [remoteVideos]);

  return (
    <div className={styles.pageContainer}>
      {inLobby ? (
        <div className={styles.lobby}>
          <div className={styles.lobbyBox}>
            <h2>Enter Lobby</h2>
            <TextField
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              variant="outlined"
              fullWidth
              style={{ marginBottom: 12 }}
            />

            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="contained" color="primary" onClick={handleJoin}>
                Join
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  // show a quick preview if camera allowed previously
                  if (localVideoRef.current && localVideoRef.current.srcObject) {
                    // do nothing
                  } else {
                    // try preview (but don't start socket)
                    navigator.mediaDevices
                      .getUserMedia({ video: true, audio: false })
                      .then((s) => {
                        setLocalStream(s);
                        if (localVideoRef.current) localVideoRef.current.srcObject = s;
                      })
                      .catch(() => {});
                  }
                }}
              >
                Preview Camera
              </Button>
            </div>

            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={styles.localPreview}
            />
          </div>
        </div>
      ) : (
        <div className={styles.meetWrapper}>
          <div className={styles.header}>
            <div className={styles.brand}>Gup-Shap</div>
            <div className={styles.roomActions}>
              <span>Room: {window.location.pathname.slice(1) || "meeting"}</span>
              <Button
                onClick={leaveCall}
                size="small"
                variant="contained"
                color="error"
                style={{ marginLeft: 12 }}
              >
                Leave
              </Button>
            </div>
          </div>

          <div className={styles.content}>
            <div className={styles.leftColumn}>
              <div className={styles.videoStage}>
                {/* main local preview */}
                <video ref={localVideoRef} className={styles.mainVideo} autoPlay muted playsInline />
                {/* grid of remote videos */}
                <div className={styles.remoteGrid}>
                  {remoteVideos.map((v) => (
                    <div key={v.socketId} className={styles.remoteItem}>
                      <video
                        ref={(el) => {
                          if (el) {
                            el.srcObject = v.stream;
                            el.autoplay = true;
                            el.playsInline = true;
                          }
                        }}
                        className={styles.remoteVideo}
                      />
                      <div className={styles.remoteLabel}>{v.socketId}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.controls}>
                <IconButton onClick={toggleVideo} className={styles.controlBtn}>
                  {videoEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
                </IconButton>

                <IconButton onClick={leaveCall} className={styles.controlBtn} style={{ color: "#ff4d4d" }}>
                  <CallEndIcon />
                </IconButton>

                <IconButton onClick={toggleAudio} className={styles.controlBtn}>
                  {audioEnabled ? <MicIcon /> : <MicOffIcon />}
                </IconButton>

                <IconButton onClick={toggleScreenShare} className={styles.controlBtn}>
                  {screenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                </IconButton>

                <Badge badgeContent={newMessagesCount} color="primary">
                  <IconButton
                    onClick={() => {
                      setChatOpen((c) => !c);
                      setNewMessagesCount(0);
                    }}
                    className={styles.controlBtn}
                  >
                    <ChatIcon />
                  </IconButton>
                </Badge>
              </div>
            </div>

            <div className={styles.rightColumn}>
              <div className={styles.chatBox}>
                <div className={styles.chatHeader}>
                  <h3>Chat</h3>
                  <span>{messages.length} messages</span>
                </div>

                <div className={styles.chatMessages}>
                  {messages.length === 0 ? (
                    <div className={styles.placeholder}>No messages yet</div>
                  ) : (
                    messages.map((m, idx) => (
                      <div key={idx} className={styles.chatMessage}>
                        <strong>{m.sender}: </strong>
                        <span>{m.data}</span>
                      </div>
                    ))
                  )}
                </div>

                <div className={styles.chatInputRow}>
                  <TextField
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Enter message"
                    variant="outlined"
                    size="small"
                    fullWidth
                  />
                  <Button onClick={sendMessage} variant="contained" style={{ marginLeft: 8 }}>
                    SEND
                  </Button>
                </div>
              </div>

              <div className={styles.participants}>
                <h4>Participants</h4>
                <div className={styles.participantList}>
                  <div className={styles.participantItem}>{username} (You)</div>
                  {remoteVideos.length === 0 && <div className={styles.placeholder}>No other participants</div>}
                  {remoteVideos.map((v) => (
                    <div key={v.socketId} className={styles.participantItem}>
                      {v.socketId}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
