import React, { useEffect, useRef, useState } from 'react'
import io from "socket.io-client";
import { Badge, IconButton, TextField } from '@mui/material';
import { Button } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import CallEndIcon from '@mui/icons-material/CallEnd'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare'
import ChatIcon from '@mui/icons-material/Chat'
import PanToolIcon from '@mui/icons-material/PanTool'
import server from '../environment';

var connections = {};
const peerConfigConnections = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
}

export default function VideoMeetComponent() {
  const socketRef = useRef();
  const socketIdRef = useRef();
  const localVideoref = useRef();
  const messageListRef = useRef();

  const [videoAvailable, setVideoAvailable] = useState(true);
  const [audioAvailable, setAudioAvailable] = useState(true);
  const [video, setVideo] = useState(true);
  const [audio, setAudio] = useState(true);
  const [screen, setScreen] = useState(false);
  const [showModal, setModal] = useState(true);
  const [screenAvailable, setScreenAvailable] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [newMessages, setNewMessages] = useState(0);
  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState("");
  const [videos, setVideos] = useState([]);
  const videoRef = useRef([]);

  const server_url = server;

  useEffect(() => {
    (async () => {
      try {
        const v = await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => null);
        setVideoAvailable(!!v);
        const a = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
        setAudioAvailable(!!a);
        setScreenAvailable(!!navigator.mediaDevices.getDisplayMedia);
        if (v || a) {
          const userMediaStream = await navigator.mediaDevices.getUserMedia({ video: !!v, audio: !!a });
          if (userMediaStream) {
            window.localStream = userMediaStream;
            if (localVideoref.current) localVideoref.current.srcObject = userMediaStream;
          }
        } else {
          window.localStream = blackSilence();
          if (localVideoref.current) localVideoref.current.srcObject = window.localStream;
        }
      } catch (e) { console.error(e) }
    })();
    // run only once
  }, []);

  useEffect(() => {
    try {
      if (window.localStream) {
        const vt = window.localStream.getVideoTracks()[0];
        if (vt) vt.enabled = !!video;
        const at = window.localStream.getAudioTracks()[0];
        if (at) at.enabled = !!audio;
      }
    } catch (e) {}
  }, [video, audio]);

  useEffect(() => { if (screen === true) startScreenShare(); else if (screen === false) stopScreenShare(); }, [screen]);

  const silence = () => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    ctx.resume();
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
  }
  const black = ({ width = 640, height = 480 } = {}) => {
    const canvas = Object.assign(document.createElement("canvas"), { width, height });
    canvas.getContext('2d').fillRect(0, 0, width, height);
    const stream = canvas.captureStream();
    return Object.assign(stream.getVideoTracks()[0], { enabled: false });
  }
  const blackSilence = () => new MediaStream([black(), silence()]);

  const getUserMediaSuccess = (stream) => {
    try { window.localStream.getTracks().forEach(t => t.stop()) } catch (e) {}
    window.localStream = stream;
    if (localVideoref.current) localVideoref.current.srcObject = stream;

    for (let id in connections) {
      if (id === socketIdRef.current) continue;
      try { connections[id].addStream(window.localStream) } catch (e) {}
      connections[id].createOffer().then(desc => {
        connections[id].setLocalDescription(desc).then(() => {
          socketRef.current.emit('signal', id, JSON.stringify({ sdp: connections[id].localDescription }));
        }).catch(console.error);
      }).catch(console.error);
    }

    stream.getTracks().forEach(track => track.onended = () => {
      try { let tracks = localVideoref.current.srcObject.getTracks(); tracks.forEach(t=>t.stop()) } catch(e){}
      window.localStream = blackSilence();
      if (localVideoref.current) localVideoref.current.srcObject = window.localStream;
      setVideo(false); setAudio(false);
      for (let id in connections) {
        try { connections[id].addStream(window.localStream) } catch(e){}
      }
    });
  }

  const getUserMedia = () => {
    if ((video && videoAvailable) || (audio && audioAvailable)) {
      navigator.mediaDevices.getUserMedia({ video: video, audio: audio }).then(getUserMediaSuccess).catch(e=>console.warn(e));
    } else {
      try { window.localStream.getTracks().forEach(t => t.stop()) } catch (e) {}
    }
  }

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      if (!stream) return;
      try { window.localStream.getTracks().forEach(t => t.stop()) } catch(e){}
      window.localStream = stream;
      if (localVideoref.current) localVideoref.current.srcObject = stream;
      for (let id in connections) {
        if (id === socketIdRef.current) continue;
        try {
          connections[id].addStream(window.localStream);
          connections[id].createOffer().then(desc => {
            connections[id].setLocalDescription(desc).then(() => {
              socketRef.current.emit('signal', id, JSON.stringify({ sdp: connections[id].localDescription }));
            }).catch(console.error);
          }).catch(console.error);
        } catch (e) { console.warn(e) }
      }
      stream.getTracks().forEach(t => t.onended = () => {
        setScreen(false);
        getUserMedia();
      });
    } catch(e) { console.warn("screen failed", e); setScreen(false); }
  }

  const stopScreenShare = () => {
    try { if (window.localStream) window.localStream.getTracks().forEach(t => t.stop()) } catch (e) {}
    getUserMedia();
  }

  const gotMessageFromServer = (fromId, message) => {
    const signal = JSON.parse(message);
    if (fromId !== socketIdRef.current) {
      if (signal.sdp) {
        connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
          if (signal.sdp.type === 'offer') {
            connections[fromId].createAnswer().then((description) => {
              connections[fromId].setLocalDescription(description).then(() => {
                socketRef.current.emit('signal', fromId, JSON.stringify({ 'sdp': connections[fromId].localDescription }))
              }).catch(console.error)
            }).catch(console.error)
          }
        }).catch(console.error)
      }
      if (signal.ice) {
        connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(console.error)
      }
    }
  }

  const connectToSocketServer = () => {
    socketRef.current = io.connect(server_url, { secure: false })
    socketRef.current.on('signal', gotMessageFromServer)

    socketRef.current.on('connect', () => {
      socketRef.current.emit('join-call', window.location.href)
      socketIdRef.current = socketRef.current.id

      socketRef.current.on('chat-message', (data, sender, socketIdSender) => {
        addMessage(data, sender, socketIdSender);
      });

      socketRef.current.on('user-left', (id) => {
        setVideos(prev => prev.filter(v => v.socketId !== id));
      });

      socketRef.current.on('user-joined', (id, clients) => {
        clients.forEach((socketListId) => {
          if (connections[socketListId]) return;
          connections[socketListId] = new RTCPeerConnection(peerConfigConnections);
          connections[socketListId].onicecandidate = function (event) {
            if (event.candidate != null) {
              socketRef.current.emit('signal', socketListId, JSON.stringify({ 'ice': event.candidate }));
            }
          };
          connections[socketListId].onaddstream = (event) => {
            const exists = videoRef.current.find(v => v.socketId === socketListId);
            if (exists) {
              setVideos(prev => prev.map(v => v.socketId === socketListId ? { ...v, stream: event.stream } : v));
            } else {
              const newV = { socketId: socketListId, stream: event.stream };
              setVideos(prev => [...prev, newV]);
              videoRef.current = [...(videoRef.current || []), newV];
            }
          };
          if (window.localStream) try { connections[socketListId].addStream(window.localStream) } catch (e) {}
          else {
            window.localStream = blackSilence();
            try { connections[socketListId].addStream(window.localStream) } catch (e) {}
          }
        });

        if (id === socketIdRef.current) {
          for (let id2 in connections) {
            if (id2 === socketIdRef.current) continue;
            try { connections[id2].addStream(window.localStream) } catch (e) {}
            connections[id2].createOffer().then((description) => {
              connections[id2].setLocalDescription(description).then(() => {
                socketRef.current.emit('signal', id2, JSON.stringify({ 'sdp': connections[id2].localDescription }));
              }).catch(console.error);
            }).catch(console.error);
          }
        }
      });

      socketRef.current.on('raised-hand', (data) => {
        addMessage(`${data.username} raised hand ✋`, "System", null);
      });
    })
  }

  const addMessage = (data, sender, socketIdSender) => {
    setMessages(prev => [...prev, { sender, data }]);
    if (socketIdSender !== socketIdRef.current) setNewMessages(n => n + 1);
    setTimeout(()=>{ if (messageListRef.current) messageListRef.current.scrollTop = messageListRef.current.scrollHeight; }, 60);
  }

  const sendMessage = () => {
    if (!message || !socketRef.current) return;
    socketRef.current.emit('chat-message', message, username || 'Guest');
    addMessage(message, 'You', socketIdRef.current);
    setMessage("");
  }

  const toggleVideo = () => setVideo(v => !v);
  const toggleAudio = () => setAudio(a => !a);
  const toggleScreen = () => setScreen(s => !s);
  const raiseHand = () => { if (socketRef.current) { socketRef.current.emit('raise-hand', { username: username || 'Guest' }); addMessage('You raised hand ✋','You', socketIdRef.current); } }

  const join = () => {
    if (!username) { alert("Please enter a username"); return; }
    setAskForUsername(false);
    getUserMedia();
    connectToSocketServer();
    setNewMessages(0);
  }

  const leave = () => {
    try { if (window.localStream) window.localStream.getTracks().forEach(t => t.stop()) } catch(e){}
    if (socketRef.current) socketRef.current.disconnect();
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen">
      {/* top */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-gradient-to-br from-purple-500 to-teal-400 flex items-center justify-center">GS</div>
          <div className="font-semibold">Gup-Shap</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-slate-400">Room: <span className="font-medium">{window.location.pathname.replace('/','') || 'main'}</span></div>
          <button onClick={leave} className="px-3 py-1 rounded-md bg-red-600 text-black"><CallEndIcon /></button>
        </div>
      </div>

      <main className="container mx-auto px-4 grid grid-cols-1 lg:grid-cols-[1fr,360px] gap-6">
        <section className="card p-4 rounded-2xl min-h-[66vh]">
          <div className="grid gap-3" style={{ gridTemplateColumns: videos.length <= 1 ? '1fr' : videos.length === 2 ? 'repeat(2,1fr)' : videos.length <= 4 ? 'repeat(2,1fr)' : 'repeat(3,1fr)' }}>
            <div className="relative bg-black/70 rounded-lg overflow-hidden">
              <video ref={localVideoref} autoPlay muted playsInline className="w-full h-full object-cover" />
              <div className="absolute left-2 bottom-2 bg-black/50 rounded-md px-2 py-1 text-xs">{username || 'You'}</div>
            </div>

            {videos.map(v => (
              <div key={v.socketId} className="relative bg-black/70 rounded-lg overflow-hidden">
                <video autoPlay playsInline ref={ref => { if (ref && v.stream) ref.srcObject = v.stream }} className="w-full h-full object-cover" />
                <div className="absolute left-2 bottom-2 bg-black/50 rounded-md px-2 py-1 text-xs">{v.socketId}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-center gap-4">
            <button onClick={toggleAudio} className={`p-3 rounded-full ${audio ? 'bg-white/10' : 'bg-red-500'}`} title="Toggle mic">
              {audio ? <MicIcon /> : <MicOffIcon />}
            </button>
            <button onClick={toggleVideo} className={`p-3 rounded-full ${video ? 'bg-white/10' : 'bg-red-500'}`} title="Toggle camera">
              {video ? <VideocamIcon /> : <VideocamOffIcon />}
            </button>
            {screenAvailable && (
              <button onClick={toggleScreen} className="p-3 rounded-full bg-white/8" title="Screen share">
                {screen ? <StopScreenShareIcon /> : <ScreenShareIcon />}
              </button>
            )}
            <button onClick={raiseHand} className="p-3 rounded-full bg-white/8" title="Raise hand"><PanToolIcon /></button>
            <Badge badgeContent={newMessages} color="warning">
              <button onClick={() => setModal(!showModal)} className="p-3 rounded-full bg-white/8" title="Chat">
                <ChatIcon />
              </button>
            </Badge>
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <div className={`card p-4 ${showModal ? '' : 'hidden'}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">Chat</h3>
              <div className="text-sm text-slate-300">{messages.length} messages</div>
            </div>
            <div ref={messageListRef} className="h-72 overflow-auto space-y-3">
              {messages.length ? messages.map((m,i) => (
                <div key={i} className={`p-2 rounded-md ${m.sender === 'You' ? 'bg-indigo-600/30 ml-auto w-[85%]' : 'bg-white/6'}`}>
                  <div className="font-semibold text-sm">{m.sender}</div>
                  <div className="text-sm text-slate-200">{m.data}</div>
                </div>
              )) : <div className="text-sm text-slate-400">No messages yet</div>}
            </div>

            <div className="mt-3 flex gap-2">
              <TextField value={message} onChange={e => setMessage(e.target.value)} size="small" placeholder="Enter Your chat" fullWidth />
              <Button variant="contained" onClick={sendMessage}>Send</Button>
            </div>
          </div>

          <div className="card p-4">
            <h4 className="font-semibold mb-2">Participants</h4>
            <div className="space-y-2">
              {videos.length === 0 ? <div className="text-sm text-slate-400">No other participants</div> : videos.map(v => (
                <div key={v.socketId} className="flex items-center gap-3 p-2 rounded-md bg-white/6">
                  <div className="w-10 h-10 rounded-md bg-gradient-to-br from-purple-500 to-pink-400 flex items-center justify-center text-black font-bold">{(v.socketId || 'U')[0]}</div>
                  <div>
                    <div className="font-semibold text-sm">{v.socketId}</div>
                    <div className="text-xs text-slate-300">connected</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>

      {askForUsername && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70">
          <div className="bg-gradient-to-br from-[#070417] to-[#0b0620] p-6 rounded-xl border border-white/6 w-[420px]">
            <h2 className="text-xl font-bold mb-3">Enter Lobby</h2>
            <TextField value={username} onChange={e => setUsername(e.target.value)} label="Username" variant="outlined" fullWidth />
            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-slate-400">Camera: {videoAvailable ? 'Yes' : 'No'}</div>
              <div className="flex gap-3">
                <Button variant="outlined" onClick={() => window.location.href = '/'}>Cancel</Button>
                <Button variant="contained" onClick={join}>Join</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
