import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import {
  Videocam,
  VideocamOff,
  Mic,
  MicOff,
  ScreenShare,
  StopScreenShare,
  Chat,
  CallEnd,
} from "@mui/icons-material";
import { Badge, IconButton, TextField, Button } from "@mui/material";
import styles from "../styles/videoComponent.module.css";
import server from "../environment";

const server_url = server;
let connections = {};

const pcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function VideoMeetComponent() {
  let socketRef = useRef();
  let socketIdRef = useRef();

  let localVideoref = useRef();

  const [videoAvailable, setVideoAvailable] = useState(true);
  const [audioAvailable, setAudioAvailable] = useState(true);

  const [video, setVideo] = useState(true);
  const [audio, setAudio] = useState(true);
  const [screen, setScreen] = useState(false);

  const [showChat, setShowChat] = useState(true);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");

  const [username, setUsername] = useState("");
  const [askName, setAskName] = useState(true);

  const videoRef = useRef([]);
  const [videos, setVideos] = useState([]);

  // -----------------------
  // PERMISSION + CAMERA FIX
  // -----------------------
  const getPermissions = async () => {
    try {
      const v = await navigator.mediaDevices.getUserMedia({ video: true });
      if (v) setVideoAvailable(true);
      const a = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (a) setAudioAvailable(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      window.localStream = stream;
      if (localVideoref.current) {
        localVideoref.current.srcObject = stream;
      }
    } catch (err) {
      console.log("Permission error:", err);
      setVideoAvailable(false);
      setAudioAvailable(false);
    }
  };

  useEffect(() => {
    getPermissions();
  }, []);

  // -----------------------
  // SOCKET + WEBRTC SETUP
  // -----------------------
  const connectToSocketServer = () => {
    socketRef.current = io.connect(server_url, { secure: false });

    socketRef.current.on("signal", handleSignal);

    socketRef.current.on("connect", () => {
      socketIdRef.current = socketRef.current.id;
      socketRef.current.emit("join-call", window.location.href);

      socketRef.current.on("user-left", (id) => {
        setVideos((prev) => prev.filter((v) => v.socketId !== id));
      });

      socketRef.current.on("chat-message", addMessage);

      socketRef.current.on("user-joined", (id, clients) => {
        clients.forEach((clientId) => {
          if (clientId === socketIdRef.current) return;

          connections[clientId] = new RTCPeerConnection(pcConfig);

          connections[clientId].onicecandidate = (event) => {
            if (event.candidate) {
              socketRef.current.emit(
                "signal",
                clientId,
                JSON.stringify({ ice: event.candidate })
              );
            }
          };

          connections[clientId].ontrack = (event) => {
            addVideoStream(clientId, event.streams[0]);
          };

          window.localStream.getTracks().forEach((track) => {
            connections[clientId].addTrack(track, window.localStream);
          });
        });

        if (id === socketIdRef.current) {
          for (let cid in connections) {
            connections[cid]
              .createOffer()
              .then((desc) => {
                connections[cid].setLocalDescription(desc);
                socketRef.current.emit(
                  "signal",
                  cid,
                  JSON.stringify({ sdp: desc })
                );
              })
              .catch(console.log);
          }
        }
      });
    });
  };

  const handleSignal = (fromId, message) => {
    let signal = JSON.parse(message);
    if (fromId === socketIdRef.current) return;

    if (signal.sdp) {
      connections[fromId]
        .setRemoteDescription(new RTCSessionDescription(signal.sdp))
        .then(() => {
          if (signal.sdp.type === "offer") {
            connections[fromId]
              .createAnswer()
              .then((desc) => {
                connections[fromId].setLocalDescription(desc);
                socketRef.current.emit(
                  "signal",
                  fromId,
                  JSON.stringify({ sdp: desc })
                );
              });
          }
        });
    }

    if (signal.ice) {
      connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice));
    }
  };

  const addVideoStream = (socketId, stream) => {
    setVideos((prev) => {
      const exists = prev.find((v) => v.socketId === socketId);
      if (exists) return prev;

      return [
        ...prev,
        {
          socketId,
          stream,
        },
      ];
    });
  };

  // -----------------------
  // CHAT
  // -----------------------
  const addMessage = (data, sender, sid) => {
    setMessages((prev) => [...prev, { data, sender }]);
  };

  const sendMessage = () => {
    if (!message.trim()) return;
    socketRef.current.emit("chat-message", message, username);
    setMessage("");
  };

  // -----------------------
  // TOGGLE CAMERA
  // -----------------------
  const toggleVideo = () => {
    const track = window.localStream
      .getVideoTracks()
      .find((track) => track.kind === "video");
    if (track) track.enabled = !track.enabled;
    setVideo(!video);
  };

  // -----------------------
  // TOGGLE AUDIO
  // -----------------------
  const toggleAudio = () => {
    const track = window.localStream
      .getAudioTracks()
      .find((track) => track.kind === "audio");
    if (track) track.enabled = !track.enabled;
    setAudio(!audio);
  };

  // -----------------------
  // JOIN ROOM
  // -----------------------
  const joinCall = () => {
    if (!username.trim()) return;
    setAskName(false);
    connectToSocketServer();
  };

  // -----------------------
  // END CALL
  // -----------------------
  const endCall = () => {
    window.location.href = "/";
  };

  // -----------------------
  // UI
  // -----------------------
  if (askName) {
    return (
      <div className="min-h-screen bg-[#0b0b23] flex items-center justify-center">
        <div className="bg-[#141430] p-10 rounded-2xl shadow-lg border border-white/10 w-[400px]">
          <h2 className="text-2xl font-bold mb-6 text-white text-center">
            Enter Lobby
          </h2>

          <TextField
            fullWidth
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            sx={{
              input: { color: "white" },
              label: { color: "#bbb" },
            }}
          />

          <Button
            fullWidth
            variant="contained"
            sx={{ mt: 4, py: 1.2, fontSize: "1rem" }}
            onClick={joinCall}
          >
            Join
          </Button>
        </div>
      </div>
    );
  }

  // -----------------------
  // MEETING UI
  // -----------------------
  return (
    <div className={styles.meetVideoContainer}>
      {/* LOCAL VIDEO */}
      <video
        className={styles.meetUserVideo}
        ref={localVideoref}
        autoPlay
        muted
      ></video>

      {/* VIDEO GRID */}
      <div className={styles.conferenceView}>
        {videos.map((v) => (
          <video
            key={v.socketId}
            autoPlay
            ref={(ref) => {
              if (ref) ref.srcObject = v.stream;
            }}
          ></video>
        ))}
      </div>

      {/* CONTROLS */}
      <div className={styles.buttonContainers}>
        <IconButton onClick={toggleVideo} style={{ color: "white" }}>
          {video ? <Videocam /> : <VideocamOff />}
        </IconButton>

        <IconButton onClick={endCall} style={{ color: "red" }}>
          <CallEnd />
        </IconButton>

        <IconButton onClick={toggleAudio} style={{ color: "white" }}>
          {audio ? <Mic /> : <MicOff />}
        </IconButton>

        <IconButton onClick={() => setShowChat(!showChat)} style={{ color: "white" }}>
          <Chat />
        </IconButton>
      </div>

      {/* CHAT PANEL */}
      {showChat && (
        <div className={styles.chatRoom}>
          <h1>Chat</h1>

          <div className={styles.chattingDisplay}>
            {messages.length === 0 ? (
              <p>No messages yet</p>
            ) : (
              messages.map((m, i) => (
                <div key={i} style={{ marginBottom: "10px" }}>
                  <p className="font-bold">{m.sender}</p>
                  <p>{m.data}</p>
                </div>
              ))
            )}
          </div>

          <div className={styles.chattingArea}>
            <TextField
              fullWidth
              label="Enter message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              sx={{
                input: { color: "white" },
                label: { color: "#bbb" },
              }}
            />
            <Button variant="contained" onClick={sendMessage}>
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

