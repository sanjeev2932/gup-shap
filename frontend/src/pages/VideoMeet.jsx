import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import {
  Badge,
  IconButton,
  TextField,
  Button,
  Tooltip
} from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from "@mui/icons-material/Chat";
import styles from "../styles/videoComponent.module.css";
import server from "../environment";

const peerConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

let peers = {}; // mapping socketId -> RTCPeerConnection

export default function VideoMeet() {
  const [connectedToServer, setConnectedToServer] = useState(false);
  const socketRef = useRef(null);
  const mySocketId = useRef(null);
  const localVideoRef = useRef(null);
  const [localStream, setLocalStream] = useState(null);

  const [username, setUsername] = useState("");
  const [inLobby, setInLobby] = useState(true);

  const [videos, setVideos] = useState([]); // {socketId, stream, name}
  const videosRef = useRef([]);
  const [messages, setMessages] = useState([]);
  const [msgText, setMsgText] = useState("");
  const [unread, setUnread] = useState(0);
  const [showChat, setShowChat] = useState(true);

  const [videoOn, setVideoOn] = useState(true);
  const [audioOn, setAudioOn] = useState(true);
  const [screenOn, setScreenOn] = useState(false);
  const screenStreamRef = useRef(null);

  // Lazily create socket only when user joins
  const connectSocket = (roomUrl) => {
    socketRef.current = io.connect(server);
    socketRef.current.on("connect", () => {
      mySocketId.current = socketRef.current.id;
      setConnectedToServer(true);
      socketRef.current.emit("join-call", roomUrl);
    });

    socketRef.current.on("signal", handleSignalFromServer);
    socketRef.current.on("user-joined", handleUserJoined);
    socketRef.current.on("user-left", handleUserLeft);
    socketRef.current.on("chat-message", (data, sender, socketIdSender) => {
      setMessages((m) => [...m, { sender, data }]);
      if (socketIdSender !== mySocketId.current) setUnread((u) => u + 1);
    });
  };

  // handle incoming SDP / ICE
  const handleSignalFromServer = async (fromId, message) => {
    if (!peers[fromId]) {
      createPeerConnection(fromId, false);
    }
    const signal = JSON.parse(message);
    try {
      if (signal.sdp) {
        await peers[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp));
        if (signal.sdp.type === "offer") {
          const answer = await peers[fromId].createAnswer();
          await peers[fromId].setLocalDescription(answer);
          socketRef.current.emit("signal", fromId, JSON.stringify({ sdp: peers[fromId].localDescription }));
        }
      } else if (signal.ice) {
        await peers[fromId].addIceCandidate(new RTCIceCandidate(signal.ice));
      }
    } catch (e) {
      console.warn("signal handling error", e);
    }
  };

  // create RTCPeerConnection and attach handlers
  const createPeerConnection = (socketId, isOfferer = false) => {
    const pc = new RTCPeerConnection(peerConfig);
    peers[socketId] = pc;

    // send ICE
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("signal", socketId, JSON.stringify({ ice: event.candidate }));
      }
    };

    pc.ontrack = (evt) => {
      // a remote stream arrived
      const stream = evt.streams[0];
      setVideos((prev) => {
        const exists = prev.find((v) => v.socketId === socketId);
        if (exists) {
          return prev.map((v) => (v.socketId === socketId ? { ...v, stream } : v));
        }
        return [...prev, { socketId, stream, name: socketId }];
      });
    };

    // add local tracks
    if (localStream) {
      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
    }

    return pc;
  };

  // called when server says someone joined - create connections for them
  const handleUserJoined = (id, clients) => {
    // create peer entries for each client if not present
    clients.forEach((sockId) => {
      if (!peers[sockId] && sockId !== mySocketId.current) {
        createPeerConnection(sockId, true);
      }
    });

    // if we are the id who just joined (server sends - ensures we make offers)
    if (id === mySocketId.current) {
      for (let otherId in peers) {
        if (otherId === mySocketId.current) continue;
        (async () => {
          try {
            const offer = await peers[otherId].createOffer();
            await peers[otherId].setLocalDescription(offer);
            socketRef.current.emit("signal", otherId, JSON.stringify({ sdp: peers[otherId].localDescription }));
          } catch (e) {
            console.warn("offer error:", e);
          }
        })();
      }
    }
  };

  const handleUserLeft = (id) => {
    // remove video
    setVideos((v) => v.filter((x) => x.socketId !== id));
    // close peer
    if (peers[id]) {
      try {
        peers[id].close();
      } catch {}
      delete peers[id];
    }
  };

  // request media permissions and attach to local video
  const requestMedia = async (useVideo = true, useAudio = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: useVideo,
        audio: useAudio
      });
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch (e) {
      console.warn("media permission error", e);
      return null;
    }
  };

  // join flow: called when pressing "Connect"
  const join = async () => {
    if (!username || username.trim() === "") {
      alert("Please enter a display name");
      return;
    }

    // get camera/mic
    const got = await requestMedia(videoOn, audioOn);
    if (!got) {
      alert("Unable to get camera/microphone. Check permissions.");
      return;
    }

    // attach tracks to existing peers (if any)
    for (const id in peers) {
      try {
        got.getTracks().forEach((t) => peers[id].addTrack(t, got));
      } catch {}
    }

    // connect socket
    connectSocket(window.location.href);
    setInLobby(false);
  };

  // toggle camera
  const toggleVideo = async () => {
    if (!localStream) {
      // attempt to get media if not present
      const s = await requestMedia(!videoOn, audioOn);
      if (s) {
        setVideoOn(true);
      }
      return;
    }
    localStream.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setVideoOn((v) => !v);
  };

  const toggleAudio = () => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setAudioOn((a) => !a);
  };

  // screen share toggle
  const toggleScreen = async () => {
    if (!screenOn) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        screenStream.getTracks().forEach((track) => {
          // replace video sender on each peer
          for (const id in peers) {
            const senders = peers[id].getSenders();
            const videoSender = senders.find((s) => s.track && s.track.kind === "video");
            if (videoSender) {
              videoSender.replaceTrack(track).catch(() => {});
            } else {
              peers[id].addTrack(track, screenStream);
            }
          }
        });

        // when screen ends, restore camera
        screenStream.getVideoTracks()[0].onended = async () => {
          screenStreamRef.current = null;
          // restore camera track
          if (localStream) {
            const camTrack = localStream.getVideoTracks()[0];
            for (const id in peers) {
              const senders = peers[id].getSenders();
              const videoSender = senders.find((s) => s.track && s.track.kind === "video");
              if (videoSender) await videoSender.replaceTrack(camTrack).catch(() => {});
            }
          }
          setScreenOn(false);
        };

        setScreenOn(true);
      } catch (e) {
        console.warn("screen share failed", e);
      }
    } else {
      // stop screen sharing
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      setScreenOn(false);
    }
  };

  const leaveCall = () => {
    // stop local media
    try {
      if (localStream) localStream.getTracks().forEach((t) => t.stop());
    } catch {}
    // close peers
    for (const id in peers) {
      try {
        peers[id].close();
      } catch {}
    }
    peers = {};
    // disconnect socket
    try {
      socketRef.current && socketRef.current.disconnect();
    } catch {}
    setVideos([]);
    setLocalStream(null);
    setInLobby(true);
    setConnectedToServer(false);
    setUnread(0);
  };

  useEffect(() => {
    // cleanup on unmount
    return () => {
      leaveCall();
    };
    // eslint-disable-next-line
  }, []);

  const sendMessage = () => {
    if (!msgText || !msgText.trim()) return;
    socketRef.current && socketRef.current.emit("chat-message", msgText, username);
    setMessages((m) => [...m, { sender: username, data: msgText }]);
    setMsgText("");
  };

  const handleKeypressMessage = (e) => {
    if (e.key === "Enter") sendMessage();
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>Gup-Shap</div>
        <div className={styles.roomInfo}>
          {inLobby ? null : (
            <>
              <span>Room: <b>{window.location.pathname.replace("/", "") || "lobby"}</b></span>
              <Button variant="contained" color="error" size="small" onClick={leaveCall} style={{ marginLeft: 12 }}>
                LEAVE
              </Button>
            </>
          )}
        </div>
      </header>

      {inLobby ? (
        <main className={styles.lobby}>
          <div className={styles.lobbyLeft}>
            <h1>Providing Quality Video Calls</h1>
            <p>Enter display name and join the call.</p>

            <TextField
              label="Display name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              variant="outlined"
              size="small"
              style={{ marginBottom: 12, width: 300 }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="contained" onClick={join}>Connect</Button>
              <Button onClick={() => { setVideoOn((v) => !v); setAudioOn((a) => !a); }}>
                Toggle defaults
              </Button>
            </div>
          </div>
          <div className={styles.lobbyRight}>
            <img src="/mobile.png" alt="mobile" />
          </div>
        </main>
      ) : (
        <main className={styles.meet}>
          <section className={styles.mainArea}>
            <div className={styles.videoStage}>
              <video ref={localVideoRef} autoPlay muted playsInline className={styles.localVideo} />
              {/* remote videos */}
              <div className={styles.remoteGrid}>
                {videos.map((v) => (
                  <div key={v.socketId} className={styles.remoteWrap}>
                    <video
                      autoPlay
                      playsInline
                      ref={(el) => {
                        if (el && v.stream) el.srcObject = v.stream;
                      }}
                      className={styles.remoteVideo}
                    />
                    <div className={styles.remoteName}>{v.name}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.controls}>
              <Tooltip title={videoOn ? "Turn camera off" : "Turn camera on"}>
                <IconButton onClick={toggleVideo} className={styles.controlBtn}>
                  {videoOn ? <VideocamIcon /> : <VideocamOffIcon />}
                </IconButton>
              </Tooltip>

              <Tooltip title="Leave call">
                <IconButton onClick={leaveCall} className={styles.endBtn}>
                  <CallEndIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title={audioOn ? "Mute" : "Unmute"}>
                <IconButton onClick={toggleAudio} className={styles.controlBtn}>
                  {audioOn ? <MicIcon /> : <MicOffIcon />}
                </IconButton>
              </Tooltip>

              <Tooltip title={screenOn ? "Stop share" : "Share screen"}>
                <IconButton onClick={toggleScreen} className={styles.controlBtn}>
                  {screenOn ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                </IconButton>
              </Tooltip>

              <Badge badgeContent={unread} color="primary">
                <IconButton onClick={() => { setShowChat((s) => !s); setUnread(0); }} className={styles.controlBtn}>
                  <ChatIcon />
                </IconButton>
              </Badge>
            </div>
          </section>

          <aside className={styles.side}>
            {showChat && (
              <div className={styles.chatBox}>
                <h3>Chat <span className={styles.msgCount}>{messages.length} messages</span></h3>
                <div className={styles.chatHistory}>
                  {messages.length ? messages.map((m, i) => (
                    <div key={i} className={styles.chatMessage}>
                      <b>{m.sender}</b><div className={styles.chatText}>{m.data}</div>
                    </div>
                  )) : <div className={styles.noMsg}>No messages yet</div>}
                </div>

                <div className={styles.chatInput}>
                  <TextField
                    value={msgText}
                    onKeyDown={handleKeypressMessage}
                    onChange={(e) => setMsgText(e.target.value)}
                    placeholder="Enter message"
                    size="small"
                    fullWidth
                    variant="outlined"
                  />
                  <Button variant="contained" onClick={sendMessage} style={{ marginTop: 8 }}>SEND</Button>
                </div>
              </div>
            )}

            <div className={styles.participants}>
              <h4>Participants</h4>
              <div className={styles.participantList}>
                <div className={styles.participantItem}>{username} (You)</div>
                {videos.length === 0 && <div className={styles.noParticipant}>No other participants</div>}
                {videos.map((v) => <div key={v.socketId} className={styles.participantItem}>{v.name}</div>)}
              </div>
            </div>
          </aside>
        </main>
      )}
    </div>
  );
}
