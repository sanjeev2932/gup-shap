import React from "react";
import "../styles/videoMeetPremium.css";


export default function CallControls({ micOn, camOn, sharing, onToggleMic, onToggleCam, onStartScreenShare, onEndCall, onRaiseHand, participants, onApproveParticipant }) {
return (
<div className="controls-bar">
<button className="ctrl-btn" onClick={onToggleMic}>{micOn ? "Mute" : "Unmute"}</button>
<button className="ctrl-btn" onClick={onToggleCam}>{camOn ? "Camera Off" : "Camera On"}</button>
<button className="ctrl-btn" onClick={onStartScreenShare}>{sharing ? "Stop Share" : "Share Screen"}</button>
<button className="ctrl-btn danger" onClick={onEndCall}>End Call</button>
<button className="ctrl-btn" onClick={onRaiseHand}>Raise Hand</button>


<div className="pending-approvals">
Pending approvals (click to approve):
{participants.filter(p => p.pending).map(p => (
<button key={p.id} className="approve-mini" onClick={() => onApproveParticipant(p.id)}>{p.username || p.id}</button>
))}
</div>
</div>
);
}