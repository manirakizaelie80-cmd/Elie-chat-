import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  PhoneOff,
  Maximize2,
  Minimize2,
  Users,
  MessageSquare,
  LayoutGrid,
  Radio,
  Volume2,
  VolumeX,
  Sparkles,
  Send,
  X
} from 'lucide-react';
import { ActiveCall, CallParticipant, User, Message } from '../types';
import { WebRTCManager } from '../utils/webrtcManager';
import { PeerMeshManager } from '../utils/peerMesh';

interface ActiveCallModalProps {
  call: ActiveCall;
  currentUser: User;
  webrtcManager: WebRTCManager | PeerMeshManager | null;
  remoteStreams: Map<string, MediaStream>;
  speakingPeers: Record<string, boolean>;
  onEndCall: () => void;
  onToggleMic: (muted: boolean) => void;
  onToggleVideo: (disabled: boolean) => void;
  onToggleScreenShare: () => Promise<boolean>;
  isScreenSharing: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  // in-call chat
  inCallMessages: Message[];
  onSendInCallMessage: (text: string) => void;
}

export const ActiveCallModal: React.FC<ActiveCallModalProps> = ({
  call,
  currentUser,
  webrtcManager,
  remoteStreams,
  speakingPeers,
  onEndCall,
  onToggleMic,
  onToggleVideo,
  onToggleScreenShare,
  isScreenSharing,
  isMuted,
  isCameraOff,
  inCallMessages,
  onSendInCallMessage,
}) => {
  const [duration, setDuration] = useState(0);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'spotlight'>('grid');
  const [spotlightUserId, setSpotlightUserId] = useState<string | null>(null);
  const [showInCallChat, setShowInCallChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Call duration counter
  useEffect(() => {
    const timer = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Attach local stream
  useEffect(() => {
    if (localVideoRef.current && webrtcManager) {
      const localStream = webrtcManager.getLocalStream();
      if (localStream) {
        localVideoRef.current.srcObject = localStream;
      }
    }
  }, [webrtcManager, isCameraOff, isScreenSharing]);

  // Attach remote streams whenever remoteStreams map updates
  useEffect(() => {
    remoteStreams.forEach((stream, peerId) => {
      const videoEl = remoteVideoRefs.current.get(peerId);
      if (videoEl && videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
    });
  }, [remoteStreams, call.participants]);

  const handleFullscreenToggle = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendInCallMessage(chatInput.trim());
    setChatInput('');
  };

  const allParticipants = call.participants;
  const remoteParticipants = allParticipants.filter((p) => p.userId !== currentUser.id);

  // If minimized, display floating dock pill
  if (isMinimized) {
    return (
      <div className="fixed bottom-5 right-5 z-50 bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-white">
            {call.isGroup ? 'Group Stage Call' : `Call: ${call.initiatorName}`}
          </span>
          <span className="text-xs text-slate-400 tabular-nums">{formatTime(duration)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onToggleMic(!isMuted)}
            className={`p-2 rounded-lg text-xs ${
              isMuted ? 'bg-red-600/20 text-red-400' : 'bg-slate-800 text-slate-200'
            }`}
          >
            {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setIsMinimized(false)}
            className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium"
          >
            Expand
          </button>
          <button
            onClick={onEndCall}
            className="p-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs"
          >
            <PhoneOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Choose spotlight participant
  const activeSpotlight = spotlightUserId
    ? allParticipants.find((p) => p.userId === spotlightUserId)
    : remoteParticipants[0] || allParticipants[0];

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col justify-between overflow-hidden"
    >
      {/* Top Header Bar */}
      <div className="h-14 border-b border-slate-800/80 px-4 md:px-6 flex items-center justify-between bg-slate-950/80 shrink-0">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <h2 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
              <span>{call.isGroup ? 'Group Conference Room' : `1-on-1 Call with ${remoteParticipants[0]?.name || 'Peer'}`}</span>
              <span className="text-xs font-normal text-slate-400">·</span>
              <span className="text-xs font-mono tabular-nums text-slate-300">{formatTime(duration)}</span>
            </h2>
            <div className="text-[11px] text-slate-400 flex items-center gap-2">
              <span>{call.type === 'video' ? 'HD Video Active' : 'Voice High-Definition'}</span>
              <span aria-hidden="true">·</span>
              <span>{allParticipants.length} {allParticipants.length === 1 ? 'participant' : 'participants'}</span>
            </div>
          </div>
        </div>

        {/* View Layout Switcher & Header Controls */}
        <div className="flex items-center gap-2">
          {call.isGroup && (
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setLayoutMode('grid')}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  layoutMode === 'grid'
                    ? 'bg-slate-800 text-white font-medium'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5 inline mr-1" />
                Grid
              </button>
              <button
                onClick={() => setLayoutMode('spotlight')}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  layoutMode === 'spotlight'
                    ? 'bg-slate-800 text-white font-medium'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5 inline mr-1" />
                Speaker
              </button>
            </div>
          )}

          <button
            onClick={() => setShowInCallChat(!showInCallChat)}
            className={`p-2 rounded-lg text-xs font-medium transition-colors ${
              showInCallChat
                ? 'bg-blue-600 text-white'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
            title="In-call chat"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          <button
            onClick={handleFullscreenToggle}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 transition-colors"
            title="Toggle fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsMinimized(true)}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 transition-colors"
            title="Minimize call"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Video Presentation Body */}
      <div className="flex-1 flex overflow-hidden p-3 md:p-6 gap-4">
        {/* Video Canvas Area */}
        <div className="flex-1 flex flex-col justify-center items-center overflow-hidden">
          {layoutMode === 'grid' || !call.isGroup ? (
            /* Responsive Video Grid */
            <div
              className={`w-full h-full grid gap-4 place-content-center ${
                allParticipants.length <= 1
                  ? 'grid-cols-1 max-w-3xl'
                  : allParticipants.length === 2
                  ? 'grid-cols-1 md:grid-cols-2 max-w-5xl'
                  : allParticipants.length <= 4
                  ? 'grid-cols-2 max-w-5xl'
                  : 'grid-cols-2 lg:grid-cols-3 max-w-6xl'
              }`}
            >
              {/* Local User Card */}
              <div
                className={`relative bg-slate-900 rounded-2xl overflow-hidden border transition-all flex items-center justify-center aspect-video shadow-lg ${
                  speakingPeers['local']
                    ? 'border-emerald-500 shadow-emerald-950/40 ring-2 ring-emerald-500/50'
                    : 'border-slate-800'
                }`}
              >
                {/* Live Video Element */}
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${isCameraOff && !isScreenSharing ? 'hidden' : 'block'}`}
                />

                {/* Avatar Fallback if camera is off */}
                {isCameraOff && !isScreenSharing && (
                  <div className="flex flex-col items-center justify-center gap-3">
                    {currentUser.avatar ? (
                      <img
                        src={currentUser.avatar}
                        alt={currentUser.name}
                        referrerPolicy="no-referrer"
                        className="w-20 h-20 rounded-full object-cover border-2 border-slate-700 shadow"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-bold">
                        {currentUser.name[0] || 'U'}
                      </div>
                    )}
                    <span className="text-xs text-slate-400 font-medium">Camera is turned off</span>
                  </div>
                )}

                {/* Local User Badge */}
                <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-sm px-2.5 py-1 rounded-lg text-xs font-medium text-white flex items-center gap-1.5 border border-slate-800">
                  <span>{currentUser.name} (You)</span>
                  {isMuted ? (
                    <MicOff className="w-3.5 h-3.5 text-red-400" />
                  ) : (
                    <Mic className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  {isScreenSharing && <ScreenShare className="w-3.5 h-3.5 text-blue-400" />}
                </div>

                {/* Speaking Indicator */}
                {speakingPeers['local'] && (
                  <div className="absolute top-3 right-3 bg-emerald-500/90 text-slate-950 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
                    Speaking
                  </div>
                )}
              </div>

              {/* Remote Participants Cards */}
              {remoteParticipants.map((peer) => {
                const isPeerSpeaking = Boolean(speakingPeers[peer.userId]);
                const isPeerCameraOff = peer.isCameraOff;

                return (
                  <div
                    key={peer.userId}
                    onClick={() => {
                      if (call.isGroup) {
                        setLayoutMode('spotlight');
                        setSpotlightUserId(peer.userId);
                      }
                    }}
                    className={`relative bg-slate-900 rounded-2xl overflow-hidden border transition-all flex items-center justify-center aspect-video shadow-lg ${
                      isPeerSpeaking
                        ? 'border-emerald-500 ring-2 ring-emerald-500/50 shadow-emerald-950/40'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Remote Video Stream Element */}
                    <video
                      ref={(el) => {
                        if (el) {
                          remoteVideoRefs.current.set(peer.userId, el);
                          const stream = remoteStreams.get(peer.userId);
                          if (stream && el.srcObject !== stream) {
                            el.srcObject = stream;
                          }
                        } else {
                          remoteVideoRefs.current.delete(peer.userId);
                        }
                      }}
                      autoPlay
                      playsInline
                      className={`w-full h-full object-cover ${isPeerCameraOff ? 'hidden' : 'block'}`}
                    />

                    {/* Remote Avatar Fallback if camera is off */}
                    {isPeerCameraOff && (
                      <div className="flex flex-col items-center justify-center gap-3">
                        {peer.avatar ? (
                          <img
                            src={peer.avatar}
                            alt={peer.name}
                            referrerPolicy="no-referrer"
                            className="w-20 h-20 rounded-full object-cover border-2 border-slate-700 shadow"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-full bg-slate-700 text-white flex items-center justify-center text-2xl font-bold">
                            {peer.name[0] || 'P'}
                          </div>
                        )}
                        <span className="text-xs text-slate-400 font-medium">Audio Only</span>
                      </div>
                    )}

                    {/* Participant Details Badge */}
                    <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-sm px-2.5 py-1 rounded-lg text-xs font-medium text-white flex items-center gap-1.5 border border-slate-800">
                      <span>{peer.name}</span>
                      {peer.isMuted ? (
                        <MicOff className="w-3.5 h-3.5 text-red-400" />
                      ) : (
                        <Mic className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </div>

                    {isPeerSpeaking && (
                      <div className="absolute top-3 right-3 bg-emerald-500/90 text-slate-950 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
                        Speaking
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Spotlight Mode Layout */
            <div className="w-full h-full flex flex-col gap-3 max-w-5xl">
              {/* Main Spotlight Window */}
              <div className="flex-1 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 relative flex items-center justify-center shadow-2xl">
                {activeSpotlight?.userId === currentUser.id ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video
                    ref={(el) => {
                      if (el && activeSpotlight) {
                        const stream = remoteStreams.get(activeSpotlight.userId);
                        if (stream) el.srcObject = stream;
                      }
                    }}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute bottom-4 left-4 bg-slate-950/80 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-2 border border-slate-800">
                  <span>{activeSpotlight?.name}</span>
                  <span className="text-[10px] text-blue-400 font-normal">Active Speaker</span>
                </div>
              </div>

              {/* Thumbnail Strip */}
              <div className="h-28 flex gap-3 overflow-x-auto pb-1">
                {allParticipants.map((p) => (
                  <div
                    key={p.userId}
                    onClick={() => setSpotlightUserId(p.userId)}
                    className={`h-full aspect-video bg-slate-900 rounded-xl overflow-hidden border cursor-pointer shrink-0 relative ${
                      activeSpotlight?.userId === p.userId ? 'border-blue-500' : 'border-slate-800'
                    }`}
                  >
                    <div className="w-full h-full flex items-center justify-center bg-slate-800 text-xs text-white font-medium">
                      {p.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* In-Call Chat Drawer */}
        {showInCallChat && (
          <div className="w-80 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl shrink-0">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                In-Call Live Messages
              </span>
              <button
                onClick={() => setShowInCallChat(false)}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {inCallMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-500 text-center px-4">
                  Messages sent here are visible to everyone currently in the call.
                </div>
              ) : (
                inCallMessages.map((m) => (
                  <div key={m.id} className="text-xs space-y-0.5">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <span className="font-semibold text-slate-200">{m.senderName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="bg-slate-800/80 p-2 rounded-lg text-slate-200 leading-relaxed break-words">
                      {m.text}
                    </p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSendChat} className="p-2 border-t border-slate-800 flex gap-1.5">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Send to call..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="p-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Control Dock (Bottom Center) */}
      <div className="h-20 border-t border-slate-800/80 bg-slate-950/90 px-6 flex items-center justify-center shrink-0">
        <div className="flex items-center gap-3">
          {/* Mute Mic */}
          <button
            onClick={() => onToggleMic(!isMuted)}
            className={`p-3.5 rounded-full transition-all duration-150 ${
              isMuted
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Toggle Video */}
          <button
            onClick={() => onToggleVideo(!isCameraOff)}
            className={`p-3.5 rounded-full transition-all duration-150 ${
              isCameraOff
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
            title={isCameraOff ? 'Turn video on' : 'Turn video off'}
          >
            {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          {/* Screen Share */}
          <button
            onClick={onToggleScreenShare}
            className={`p-3.5 rounded-full transition-all duration-150 ${
              isScreenSharing
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
            title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
          >
            <ScreenShare className="w-5 h-5" />
          </button>

          {/* Hang Up Button */}
          <button
            onClick={onEndCall}
            className="px-6 py-3.5 bg-red-600 hover:bg-red-500 text-white rounded-full font-semibold text-xs tracking-wide shadow-lg shadow-red-600/30 flex items-center gap-2 transition-all duration-150 active:scale-95"
            title="Leave / Hang Up Call"
          >
            <PhoneOff className="w-5 h-5" />
            <span>Leave Call</span>
          </button>
        </div>
      </div>
    </div>
  );
};
