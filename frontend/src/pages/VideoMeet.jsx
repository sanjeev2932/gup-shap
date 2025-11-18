// frontend/src/pages/VideoMeet.jsx
import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import "./videoMeetOverrides.css"; // optional small overrides (see index.css if you don't have this)

import server from "../environment";

const server_url = server;
let connections = {};

const pcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function VideoMeetComponent() {
  const socketRef = useRef(null);
  const socketIdRef = useRef(null);
  const localVideoRef = useRef(null);

  const [askName, setAskName] = useState(true);
  const [username, setUsername] = useState("");
  const [videos, setVideos] = useState([]);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [showChat, setShowChat] = useState(true);

  // IMPORTANT: do NOT call getUserMedia on mount. We'll request only after a user action.
  // This avoids browsers blocking the permission prompt.

  // ask for camera/mic permission and set up local stream
  const getPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      window.localStream = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setVideoEnabled(true);
      setAudioEnabled(true);
      return true;
    } catch (e) {
      console.error("Permission error", e);
      setVideoEnabled(false);
      setAudioEnabled(false);
      return false;
    }
  };

  const addVideoStream = (socketId, stream) => {
    setVideos((prev) => {
      if (prev.find((p) => p.socketId === socketId)) return prev;
      return [...prev, { socketId, stream }];
    });
  };

  // handle incoming signaling
  const handleSignal = (fromId, message) => {
    try {
      const signal = JSON.parse(message);
      if (!connections[fromId]) {
        // create peer connection if it doesn't exist
        connections[fromId] = new RTCPeerConnection(pcConfig);
        setupPeerEvents(fromId);
      }
      const pc = connections[fromId];

      if (signal.sdp) {
        pc.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
          if (signal.sdp.type === "offer") {
            pc.createAnswer().then((answer) => {
              pc.setLocalDescription(answer).then(() => {
                socketRef.current.emit("signal", fromId, JSON.stringify({ sdp: pc.localDescription }));
              });
            });
          }
        });
      }
      if (signal.ice) {
        pc.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(console.error);
      }
    } catch (e) {
      console.error("Signal parse error", e);
    }
  };

  const setupPeerEvents = (peerId) => {
    const pc = connections[peerId];
    if (!pc) return;

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        socketRef.current.emit("signal", peerId, JSON.stringify({ ice: ev.candidate }));
      }
    };

    pc.ontrack = (event) => {
      // add remote stream
      addVideoStream(peerId, event.streams[0]);
    };

    // add local tracks (if available)
    if (window.localStream) {
      window.localStream.getTracks().forEach((t) => pc.addTrack(t, window.localStream));
    }
  };

  // connect to socket and set up listeners
  const connectToSocketServer = () => {
    socketRef.current = io.connect(server_url, { secure: false });

    socketRef.current.on("connect", () => {
      socketIdRef.current = socketRef.current.id;
      socketRef.current.emit("join-call", window.location.href);

      socketRef.current.on("user-joined", (id, clients) => {
        // for each client create peer connection
        clients.forEach((clientId) => {
          if (clientId === socketIdRef.current) return;

          if (!connections[clientId]) {
            connections[clientId] = new RTCPeerConnection(pcConfig);
            setupPeerEvents(clientId);
          }
        });

        // if we are the one who just joined, create offers to others
        if (id === socketIdRef.current) {
          for (let id2 in connections) {
            if (id2 === socketIdRef.current) continue;
            connections[id2]
              .createOffer()
              .then((desc) => {
                connections[id2].setLocalDescription(desc).then(() => {
                  socketRef.current.emit("signal", id2, JSON.stringify({ sdp: desc }));
                });
              })
              .catch(console.error);
          }
        }
      });

      socketRef.current.on("signal", handleSignal);

      socketRef.current.on("chat-message", (data, sender) => {
        setMessages((m) => [...m, { data, sender }]);
      });

      socketRef.current.on("user-left", (id) => {
        // remove video
        setVideos((prev) => prev.filter((v) => v.socketId !== id));
        if (connections[id]) {
          try {
            connections[id].close();
          } catch (e) {}
          delete connections[id];
        }
      });
    });

    socketRef.current.on("disconnect", () => {
      // cleanup if needed
    });
  };

  // called when user clicks JOIN (username must be present)
  const joinCall = async () => {
    if (!username || username.trim() === "") {
      alert("Please enter a username to join");
      return;
    }

    const granted = await getPermissions();
    if (!granted) {
      alert("Camera / Microphone permission required to join call.");
      return;
    }

    setAskName(false);
    connectToSocketServer();
  };

  const toggleVideo = () => {
    try {
      const t = window.localStream?.getVideoTracks()?.[0];
      if (t) {
        t.enabled = !t.enabled;
        setVideoEnabled(t.enabled);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const toggleAudio = () => {
    try {
      const t = window.localStream?.getAudioTracks()?.[0];
      if (t) {
        t.enabled = !t.enabled;
        setAudioEnabled(t.enabled);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const sendMessage = () => {
    if (!message || message.trim() === "") return;
    socketRef.current.emit("chat-message", message, username);
    setMessages((m) => [...m, { sender: username, data: message }]);
    setMessage("");
  };

  const leaveCall = () => {
    try {
      if (localVideoRef.current && localVideoRef.current.srcObject) {
        localVideoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      }
    } catch (e) {}
    window.localStream = null;
    // close peers
    Object.values(connections).forEach((pc) => {
      try {
        pc.close();
      } catch (e) {}
    });
    connections = {};
    if (socketRef.current) socketRef.current.disconnect();
    // go back
    window.location.href = "/";
  };

  // render lobby screen if askName true
  if (askName) {
    return (
      <div className="page-center">
        <div className="card">
          <h2>Join Lobby</h2>
          <input
            className="input"
            placeholder="Enter display name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <div style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={joinCall}>
              Join Call
            </button>
          </div>

          {/* preview local video if permission already granted */}
          <div style={{ marginTop: 16 }}>
            <video ref={localVideoRef} autoPlay muted className="localPreview" />
          </div>
        </div>
      </div>
    );
  }

  // main meeting UI
  return (
    <div className="meeting-root">
      <header className="topbar">
        <div className="logo">Gup-Shap</div>
        <div className="room-meta">Room: {window.location.pathname.slice(1)}</div>
        <div className="right-ctas">
          <button className="link" onClick={leaveCall}>
            Leave
          </button>
        </div>
      </header>

      <main className="meeting-main">
        <section className="video-area">
          {/* Local video */}
          <div className="local-card">
            <video ref={localVideoRef} autoPlay muted className="localVideo" />
            <div className="label">{username}</div>
          </div>

          {/* Remote videos */}
          <div className="remote-grid">
            {videos.map((v) => (
              <div key={v.socketId} className="remote-card">
                <video
                  autoPlay
                  playsInline
                  ref={(ref) => {
                    if (ref && v.stream) ref.srcObject = v.stream;
                  }}
                />
              </div>
            ))}
          </div>

          {/* controls */}
          <div className="controls">
            <button className="control-btn" onClick={toggleVideo}>
              {videoEnabled ? "Camera Off" : "Camera On"}
            </button>
            <button className="control-btn end" onClick={leaveCall}>
              End
            </button>
            <button className="control-btn" onClick={toggleAudio}>
              {audioEnabled ? "Mute" : "Unmute"}
            </button>
            <button className="control-btn" onClick={() => setShowChat(!showChat)}>
              Chat
            </button>
          </div>
        </section>

        <aside className={`chat-aside ${showChat ? "open" : "closed"}`}>
          <div className="chat-header">
            <h3>Chat</h3>
            <div>{messages.length} messages</div>
          </div>

          <div className="chat-body">
            {messages.length === 0 && <div className="muted">No messages yet</div>}
            {messages.map((m, i) => (
              <div key={i} className="chat-message">
                <b>{m.sender}</b>
                <div>{m.data}</div>
              </div>
            ))}
          </div>

          <div className="chat-footer">
            <input className="input" placeholder="Enter message" value={message} onChange={(e) => setMessage(e.target.value)} />
            <button className="btn" onClick={sendMessage}>
              Send
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
}
