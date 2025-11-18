import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import io from "socket.io-client";
import server from "../environment"; // keep your environment export

/*
  Dark themed Video meeting page.
  This file focuses on UI and local getUserMedia permission prompt.
  It also attempts to connect to socket server (if running) using same env.
  The detailed multi-peer RTC you already had can be plugged back into this file
  if you want full multi-stream features. I keep it lean & working for permissions + local preview + chat skeleton.
*/

export default function VideoMeetComponent() {
  const { url } = useParams();
  const navigate = useNavigate();
  const localVideoRef = useRef(null);
  const socketRef = useRef(null);

  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [participants, setParticipants] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // enable dark meeting body
    document.body.classList.remove("light-mode");
    document.body.classList.add("dark-meeting");

    initLocalStream();

    // connect to socket (if server available)
    try {
      socketRef.current = io.connect(server, { transports:["websocket","polling"] });
      socketRef.current.on("connect", () => {
        socketRef.current.emit("join-call", window.location.href);
        setConnected(true);
      });

      socketRef.current.on("chat-message", (data, sender) => {
        setMessages(prev => [...prev, { sender, data }]);
      });

      socketRef.current.on("user-joined", (id, clients) => {
        setParticipants(clients);
      });

      socketRef.current.on("user-left", (id) => {
        setParticipants(prev => prev.filter(p => p !== id));
      });
    } catch (e) {
      console.warn("Socket connect failed:", e);
    }

    return () => {
      stopLocalStream();
      if (socketRef.current) socketRef.current.disconnect();
      document.body.classList.remove("dark-meeting");
    };
    // eslint-disable-next-line
  }, []);

  const initLocalStream = async () => {
    try {
      const constraints = { video: true, audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      window.localStream = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setCameraOn(true);
      setMicOn(true);
    } catch (e) {
      console.error("Permissions denied or error:", e);
      setCameraOn(false);
      setMicOn(false);
    }
  };

  const stopLocalStream = () => {
    try {
      if (window.localStream) {
        window.localStream.getTracks().forEach(t => t.stop());
      }
    } catch (e) {}
  };

  const toggleCamera = () => {
    try {
      const videoTracks = window.localStream?.getVideoTracks();
      if (videoTracks && videoTracks[0]) {
        videoTracks[0].enabled = !videoTracks[0].enabled;
        setCameraOn(videoTracks[0].enabled);
      }
    } catch (e) {}
  };

  const toggleMic = () => {
    try {
      const audioTracks = window.localStream?.getAudioTracks();
      if (audioTracks && audioTracks[0]) {
        audioTracks[0].enabled = !audioTracks[0].enabled;
        setMicOn(audioTracks[0].enabled);
      }
    } catch (e) {}
  };

  const endCall = () => {
    stopLocalStream();
    navigate("/");
  };

  const sendMessage = () => {
    if (!message) return;
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("chat-message", message, "You");
    }
    setMessages(prev => [...prev, { sender: "You", data: message }]);
    setMessage("");
  };

  return (
    <div className="min-h-screen p-6">
      <header className="flex justify-between items-center mb-6">
        <div className="text-white font-semibold">Gup-Shap</div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-gray-300">Room: <span className="text-blue-400">{url || "unknown"}</span></div>
          <button className="px-3 py-1 rounded bg-red-600 text-white" onClick={endCall}>LEAVE</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="video-card p-4">
            <div className="w-full h-64 bg-black rounded-md overflow-hidden video-card">
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            </div>

            <div className="mt-4 flex items-center gap-4">
              <button onClick={toggleCamera} className="p-3 rounded-full bg-gray-800">
                {cameraOn ? "📷" : "📷✖️"}
              </button>
              <button onClick={endCall} className="p-3 rounded-full bg-red-700 text-white">📞</button>
              <button onClick={toggleMic} className="p-3 rounded-full bg-gray-800">
                {micOn ? "🎤" : "🎤✖️"}
              </button>
              <div className="ml-4 text-sm text-gray-300">
                {connected ? "Connected to signaling" : "Not connected to signaling server"}
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="p-4 rounded-md bg-gray-900/80">
            <div className="flex justify-between items-center mb-3">
              <div className="text-white font-semibold">Chat</div>
              <div className="text-sm text-gray-400">{messages.length} messages</div>
            </div>

            <div className="chat-scroll mb-3">
              {messages.length === 0 && <div className="text-gray-500">No messages yet</div>}
              {messages.map((m, i) => (
                <div key={i} className="mb-2">
                  <div className="text-sm text-gray-400">{m.sender}</div>
                  <div className="text-sm text-white">{m.data}</div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                value={message}
                onChange={(e)=>setMessage(e.target.value)}
                className="input-dark"
                placeholder="Enter message"
              />
              <button className="px-4 py-2 rounded bg-blue-600 text-white" onClick={sendMessage}>SEND</button>
            </div>
          </div>

          <div className="p-4 rounded-md bg-gray-900/80">
            <div className="text-white font-semibold mb-2">Participants</div>
            <div className="text-gray-400 text-sm mb-2">
              {participants.length === 0 ? "No other participants" : `${participants.length} participants`}
            </div>
            <div className="text-sm text-gray-200">
              {participants.map(p => <div key={p} className="py-1 text-gray-300">{p}</div>)}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
