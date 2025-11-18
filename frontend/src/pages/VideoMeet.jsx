// frontend/src/pages/VideoMeet.jsx
import React, { useEffect, useRef, useState, useContext } from "react";
import io from "socket.io-client";
import { IconButton, TextField, Button } from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from "@mui/icons-material/Chat";
import { AuthContext } from "../contexts/AuthContext";
import styles from "../styles/videoComponent.module.css";
import server from "../environment";

const peerConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

let connections = {};

export default function VideoMeetComponent() {
  const { user } = useContext(AuthContext);
  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState(user?.username || "");
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [newMessages, setNewMessages] = useState(0);
  const [showChat, setShowChat] = useState(true);

  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);

  const localVideoRef = useRef();
  const socketRef = useRef();
  const socketIdRef = useRef();
  const [remoteVideos, setRemoteVideos] = useState([]);

  // Request permissions once on mount
  useEffect(() => {
    // don't spam prompts: only ask when actually trying to join call
  }, []);

  useEffect(() => {
    // cleanup on unmount
    return () => {
      try {
        if (localVideoRef.current && localVideoRef.current.srcObject) {
          localVideoRef.current.srcObject.getTracks().forEach(t => t.stop());
        }
        if (socketRef.current) socketRef.current.disconnect();
      } catch (e) {}
    };
  }, []);

  async function startLocalStream(video = true, audio = true) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
      window.localStream = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch (e) {
      console.error("Media permission error:", e);
      throw e;
    }
  }

  function createPeerConnection(peerId) {
    const pc = new RTCPeerConnection(peerConfig);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("signal", peerId, JSON.stringify({ ice: event.candidate }));
      }
    };

    pc.ontrack = (evt) => {
      // add remote video
      const stream = evt.streams[0];
      setRemoteVideos(prev => {
        const found = prev.find(v => v.peerId === peerId);
        if (found) {
          return prev.map(v => (v.peerId === peerId ? { ...v, stream } : v));
        }
        return [...prev, { peerId, stream }];
      });
    };

    return pc;
  }

  const connectToSocket = (roomPath) => {
    socketRef.current = io.connect(server);
    socketRef.current.on("connect", () => {
      socketIdRef.current = socketRef.current.id;
      socketRef.current.emit("join-call", roomPath);

      socketRef.current.on("signal", (fromId, message) => {
        onSignal(fromId, message);
      });

      socketRef.current.on("user-joined", (id, clients) => {
        // create RTCPeerConnections for everyone
        clients.forEach((peerId) => {
          if (!connections[peerId]) {
            const pc = createPeerConnection(peerId);
            connections[peerId] = pc;
            // add local tracks
            try {
              window.localStream && window.localStream.getTracks().forEach(track => pc.addTrack(track, window.localStream));
            } catch (e) {}
            if (socketIdRef.current === id) {
              // If new client is us, make offers to others
              pc.createOffer().then(desc => {
                return pc.setLocalDescription(desc);
              }).then(() => {
                socketRef.current.emit("signal", peerId, JSON.stringify({ sdp: pc.localDescription }));
              }).catch(console.error);
            }
          }
        });
      });

      socketRef.current.on("chat-message", (data, sender, sid) => {
        setMessages(prev => [...prev, { sender, data }]);
        if (sid !== socketIdRef.current) setNewMessages(n => n + 1);
      });

      socketRef.current.on("user-left", (id) => {
        // remove video and close pc
        if (connections[id]) {
          try { connections[id].close(); } catch (e) {}
          delete connections[id];
        }
        setRemoteVideos(prev => prev.filter(v => v.peerId !== id));
      });
    });
  };

  const onSignal = async (fromId, message) => {
    const signal = JSON.parse(message);
    if (!connections[fromId]) {
      connections[fromId] = createPeerConnection(fromId);
      // attach local tracks
      try {
        window.localStream && window.localStream.getTracks().forEach(track => connections[fromId].addTrack(track, window.localStream));
      } catch (e) {}
    }
    const pc = connections[fromId];

    if (signal.sdp) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        if (signal.sdp.type === "offer") {
          const desc = await pc.createAnswer();
          await pc.setLocalDescription(desc);
          socketRef.current.emit("signal", fromId, JSON.stringify({ sdp: pc.localDescription }));
        }
      } catch (e) { console.error(e); }
    }

    if (signal.ice) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(signal.ice));
      } catch (e) { console.error(e); }
    }
  };

  const joinRoom = async () => {
    setAskForUsername(false);

    // try to get local media
    try {
      await startLocalStream(videoEnabled, audioEnabled);
    } catch (e) {
      alert("Please allow camera/microphone access in your browser for video calls.");
      return;
    }

    connectToSocket(window.location.href);
  };

  const toggleVideo = async () => {
    if (!window.localStream) {
      await startLocalStream(!videoEnabled, audioEnabled);
    }
    window.localStream.getVideoTracks().forEach(t => { t.enabled = !videoEnabled; });
    setVideoEnabled(!videoEnabled);
  };

  const toggleAudio = () => {
    if (!window.localStream) return;
    window.localStream.getAudioTracks().forEach(t => { t.enabled = !audioEnabled; });
    setAudioEnabled(!audioEnabled);
  };

  const handleSendMessage = () => {
    if (!socketRef.current) return;
    socketRef.current.emit("chat-message", message, username || "Anonymous");
    setMessages(prev => [...prev, { sender: username || "You", data: message }]);
    setMessage("");
  };

  const leaveCall = () => {
    try {
      if (localVideoRef.current && localVideoRef.current.srcObject) {
        localVideoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
    } catch (e) {}
    try {
      socketRef.current && socketRef.current.disconnect();
    } catch (e) {}
    connections = {};
    window.localStream = null;
    window.location.href = "/";
  };

  return (
    <div style={{ padding: 18 }}>
      {askForUsername ? (
        <div className="center-box" style={{ minHeight: "calc(100vh - 80px)" }}>
          <div className="card" style={{ width: 520 }}>
            <h3>Enter into Lobby</h3>
            <TextField label="Username" variant="outlined" fullWidth value={username} onChange={(e) => setUsername(e.target.value)} style={{ margin: "12px 0" }} />
            <div style={{ display: "flex", gap: 12 }}>
              <Button variant="contained" onClick={joinRoom} className="btn">Connect</Button>
              <Button variant="outlined" onClick={() => { setUsername("Guest_" + Math.random().toString(36).slice(2,6)); }}>Join as Guest</Button>
            </div>
            <div style={{ marginTop: 14 }}>
              <video ref={localVideoRef} autoPlay muted style={{ width: "100%", height: 220, background: "#000", borderRadius: 6 }} />
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.meetVideoContainer}>
          <div style={{ flex: 1 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={{ fontWeight:700 }}>Gup-Shap</div>
              <div>Room: <span style={{ color: "#49a" }}>{window.location.pathname.replace("/", "")}</span> <Button variant="contained" onClick={leaveCall} style={{ background: "#c33" }}>LEAVE</Button></div>
            </div>

            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div className="meetUserVideo" style={{ height: 420 }}>
                  <video ref={localVideoRef} autoPlay muted style={{ width:"100%", height:"100%", objectFit: "cover", borderRadius: 8 }} />
                </div>

                <div className="buttonContainers" style={{ marginTop: 12 }}>
                  <IconButton onClick={toggleVideo} style={{ color: "white", background:"#1b1a22" }}>
                    {videoEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
                  </IconButton>
                  <IconButton onClick={leaveCall} style={{ color: "red", background:"#1b1a22" }}><CallEndIcon /></IconButton>
                  <IconButton onClick={toggleAudio} style={{ color: "white", background:"#1b1a22" }}>
                    {audioEnabled ? <MicIcon /> : <MicOffIcon />}
                  </IconButton>
                  <IconButton onClick={() => setScreenSharing(s => !s)} style={{ color: "white", background:"#1b1a22" }}>
                    {screenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                  </IconButton>
                  <IconButton onClick={() => { setShowChat(s => !s); setNewMessages(0); }} style={{ color: "white", background:"#1b1a22" }}>
                    <ChatIcon />
                  </IconButton>
                </div>

                <div className="conferenceView" style={{ marginTop: 12 }}>
                  {remoteVideos.map(rv => (
                    <div key={rv.peerId} style={{ width: 260 }}>
                      <video
                        autoPlay
                        playsInline
                        ref={el => { if (el && rv.stream) el.srcObject = rv.stream; }}
                        style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 8 }}
                      />
                      <div style={{ color: "#9aa", marginTop: 6 }}>{rv.peerId}</div>
                    </div>
                  ))}
                </div>
              </div>

              {showChat && (
                <div className={styles.chatRoom}>
                  <div className={styles.chatContainer}>
                    <h3>Chat <span style={{ float: "right", color: "#9aa" }}>{messages.length} messages</span></h3>
                    <div className={styles.chattingDisplay}>
                      {messages.length ? messages.map((m,i) => (
                        <div key={i} style={{ marginBottom: 12 }}>
                          <div style={{ fontWeight: 700 }}>{m.sender}</div>
                          <div style={{ color: "#dcdde1" }}>{m.data}</div>
                        </div>
                      )) : <div className="small-muted">No messages yet</div>}
                    </div>
                    <div className={styles.chattingArea} style={{ marginTop: 12 }}>
                      <input placeholder="Enter message" value={message} onChange={e => setMessage(e.target.value)} style={{ flex:1, padding: 8, borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: "#fff" }} />
                      <button className="btn" onClick={handleSendMessage} style={{ marginLeft: 8 }}>SEND</button>
                    </div>
                    <div style={{ marginTop: 18 }}>
                      <h4>Participants</h4>
                      <div style={{ background: "rgba(255,255,255,0.02)", padding: 10, borderRadius: 8 }}>
                        <div>{username} (You)</div>
                        <div className="small-muted">No other participants</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
