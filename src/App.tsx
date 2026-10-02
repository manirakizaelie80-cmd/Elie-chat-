import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TopNav } from './components/TopNav';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { WorldMapView } from './components/WorldMapView';
import { ActiveCallModal } from './components/ActiveCallModal';
import { IncomingCallModal } from './components/IncomingCallModal';
import { UserProfileModal } from './components/UserProfileModal';
import { CreateChannelModal } from './components/CreateChannelModal';
import { MultiTabHelperModal } from './components/MultiTabHelperModal';
import { User, Room, Message, ActiveCall, ViewTab } from './types';
import { WebRTCManager } from './utils/webrtcManager';
import { getUserMediaSafe } from './utils/mediaFallback';
import { 
  playCallingRing, 
  playCallConnected, 
  playCallEnded, 
  playMessageNotification, 
  stopRingtone 
} from './utils/audioSynth';

export default function App() {
  // 1. Identify User Session
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const params = new URLSearchParams(window.location.search);
    const persona = params.get('persona');

    if (persona === 'designer') {
      return {
        id: 'user-marcus',
        name: 'Marcus Vance',
        avatar: '/src/assets/images/avatar_designer_1790668663121.jpg',
        status: 'online',
        customStatus: '🎨 Product Designer · New York, USA',
        location: {
          city: 'New York',
          country: 'United States',
          flag: '🇺🇸',
          timezone: 'America/New_York',
          lat: 40.7128,
          lng: -74.0060,
        },
        lastActive: Date.now(),
      };
    } else if (persona === 'lead') {
      return {
        id: 'user-elena',
        name: 'Elena Rostova',
        avatar: '/src/assets/images/avatar_tech_lead_1790668646558.jpg',
        status: 'online',
        customStatus: '⚡ Tech Lead · Berlin, Germany',
        location: {
          city: 'Berlin',
          country: 'Germany',
          flag: '🇩🇪',
          timezone: 'Europe/Berlin',
          lat: 52.5200,
          lng: 13.4050,
        },
        lastActive: Date.now(),
      };
    } else if (persona === 'tokyo') {
      return {
        id: 'user-kenji',
        name: 'Kenji Sato',
        avatar: '/src/assets/images/avatar_developer_1790668686679.jpg',
        status: 'online',
        customStatus: '🗼 Software Architect · Tokyo, Japan',
        location: {
          city: 'Tokyo',
          country: 'Japan',
          flag: '🇯🇵',
          timezone: 'Asia/Tokyo',
          lat: 35.6762,
          lng: 139.6503,
        },
        lastActive: Date.now(),
      };
    }

    const saved = localStorage.getItem('syncwave_current_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.location) return parsed;
      } catch (e) {
        // ignore
      }
    }

    // Default Host: Elie Manirakiza in Kigali, Rwanda
    return {
      id: 'user-elie',
      name: 'Elie Manirakiza',
      avatar: '/src/assets/images/avatar_elie_1790670827487.jpg',
      status: 'online',
      customStatus: '🌍 Founder & Host · Kigali, Rwanda',
      location: {
        city: 'Kigali',
        country: 'Rwanda',
        flag: '🇷🇼',
        timezone: 'Africa/Kigali',
        lat: -1.9441,
        lng: 30.0619,
      },
      lastActive: Date.now(),
    };
  });

  // Save profile changes
  useEffect(() => {
    localStorage.setItem('syncwave_current_user', JSON.stringify(currentUser));
  }, [currentUser]);

  // App State
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);

  // Navigation State
  const [activeTab, setActiveTab] = useState<ViewTab>('chats');
  const [activeRoomId, setActiveRoomId] = useState<string | null>('global-connect');
  const [activeDirectUserId, setActiveDirectUserId] = useState<string | null>(null);

  // Typing State
  const [typingUsers, setTypingUsers] = useState<{ userId: string; userName: string; targetId: string }[]>([]);

  // Modals
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [isMultiTabOpen, setIsMultiTabOpen] = useState(false);

  // Incoming Call Prompt
  const [incomingCallData, setIncomingCallData] = useState<{
    callId: string;
    callType: 'audio' | 'video';
    caller: { id: string; name: string; avatar?: string };
    isGroup: boolean;
  } | null>(null);

  // Current Active Call
  const [currentCall, setCurrentCall] = useState<ActiveCall | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [speakingPeers, setSpeakingPeers] = useState<Record<string, boolean>>({});

  // WebSocket Ref
  const wsRef = useRef<WebSocket | null>(null);
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);

  // WebSocket Connection
  useEffect(() => {
    let reconnectTimeout: any = null;

    const connectWs = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // Identify ourselves
        ws.send(
          JSON.stringify({
            type: 'identify',
            user: currentUser,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'init_sync': {
              setUsers(data.users || []);
              setRooms(data.rooms || []);
              setMessages(data.messages || []);
              setActiveCalls(data.activeCalls || []);
              break;
            }

            case 'presence:update': {
              setUsers((prev) => {
                const idx = prev.findIndex((u) => u.id === data.user.id);
                if (idx > -1) {
                  const updated = [...prev];
                  updated[idx] = data.user;
                  return updated;
                }
                return [...prev, data.user];
              });
              break;
            }

            case 'presence:user_left': {
              setUsers((prev) => prev.filter((u) => u.id !== data.userId));
              break;
            }

            case 'chat:new_message': {
              setMessages((prev) => {
                if (prev.some((m) => m.id === data.message.id)) return prev;
                return [...prev, data.message];
              });

              if (data.message.senderId !== currentUser.id) {
                playMessageNotification();
              }
              break;
            }

            case 'chat:reaction_updated': {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === data.messageId ? { ...m, reactions: data.reactions } : m
                )
              );
              break;
            }

            case 'chat:user_typing': {
              if (data.isTyping) {
                setTypingUsers((prev) => {
                  if (prev.some((t) => t.userId === data.userId && t.targetId === data.targetId)) return prev;
                  return [...prev, { userId: data.userId, userName: data.userName, targetId: data.targetId }];
                });
              } else {
                setTypingUsers((prev) =>
                  prev.filter((t) => !(t.userId === data.userId && t.targetId === data.targetId))
                );
              }
              break;
            }

            case 'room:created': {
              setRooms((prev) => {
                if (prev.some((r) => r.id === data.room.id)) return prev;
                return [...prev, data.room];
              });
              break;
            }

            case 'calls:updated': {
              setActiveCalls(data.activeCalls || []);
              // If current call is in progress, update its participant info
              setCurrentCall((current) => {
                if (!current) return null;
                const match = (data.activeCalls as ActiveCall[]).find(
                  (c) => c.callId === current.callId
                );
                return match || current;
              });
              break;
            }

            // ============ WEBRTC & CALL SIGNALING ============
            case 'call:incoming': {
              setIncomingCallData({
                callId: data.callId,
                callType: data.callType,
                caller: data.caller,
                isGroup: data.isGroup,
              });
              break;
            }

            case 'call:participant_joined': {
              const { callId, participant } = data;
              if (currentCall && currentCall.callId === callId && participant.userId !== currentUser.id) {
                // We initiate connection to the new participant
                webrtcManagerRef.current?.initiateConnectionTo(participant.userId);
              }
              break;
            }

            case 'call:participant_left': {
              const { userId } = data;
              webrtcManagerRef.current?.removePeer(userId);
              setRemoteStreams((prev) => {
                const updated = new Map(prev);
                updated.delete(userId);
                return updated;
              });
              break;
            }

            case 'call:signal': {
              const { fromPeerId, signal } = data;
              webrtcManagerRef.current?.handleSignal(fromPeerId, signal);
              break;
            }

            case 'call:rejected': {
              stopRingtone();
              alert(`Call was declined.`);
              endCallCleanup();
              break;
            }

            case 'call:ended': {
              if (currentCall && currentCall.callId === data.callId) {
                playCallEnded();
                endCallCleanup();
              }
              break;
            }
          }
        } catch (err) {
          console.error('Error parsing WS message:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimeout = setTimeout(connectWs, 2000);
      };

      ws.onerror = (err) => {
        console.warn('WS error:', err);
      };
    };

    connectWs();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      wsRef.current?.close();
    };
  }, [currentUser.id]);

  // Clean up call
  const endCallCleanup = useCallback(() => {
    stopRingtone();
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.destroy();
      webrtcManagerRef.current = null;
    }
    setRemoteStreams(new Map());
    setSpeakingPeers({});
    setCurrentCall(null);
    setIsScreenSharing(false);
    setIsMuted(false);
    setIsCameraOff(false);
  }, []);

  // Initialize WebRTC Manager helper
  const initWebRTCManager = useCallback((callId: string) => {
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.destroy();
    }

    const manager = new WebRTCManager({
      sendSignal: (toPeerId, signal) => {
        wsRef.current?.send(
          JSON.stringify({
            type: 'call:signal',
            callId,
            toPeerId,
            fromPeerId: currentUser.id,
            signal,
          })
        );
      },
      onRemoteStream: (peerId, stream) => {
        setRemoteStreams((prev) => new Map(prev).set(peerId, stream));
      },
      onRemoteLeave: (peerId) => {
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(peerId);
          return next;
        });
      },
      onPeerSpeaking: (peerId, { isSpeaking }) => {
        setSpeakingPeers((prev) => ({ ...prev, [peerId]: Boolean(isSpeaking) }));
      },
    });

    webrtcManagerRef.current = manager;
    return manager;
  }, [currentUser.id]);

  // Handle Starting a Call (1-on-1 or Group)
  const handleStartCall = async (type: 'audio' | 'video', targetUser?: User, room?: Room) => {
    const isGroup = Boolean(room);
    const callId = `call-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const targetId = isGroup ? room!.id : (targetUser?.id || activeDirectUserId!);

    // Acquire audio & video media safely
    const { stream } = await getUserMediaSafe(
      {
        audio: true,
        video: type === 'video',
      },
      currentUser.name
    );

    const manager = initWebRTCManager(callId);
    manager.setLocalStream(stream);

    setIsCameraOff(type === 'audio');
    setIsMuted(false);

    const initialCall: ActiveCall = {
      callId,
      type,
      isGroup,
      targetId,
      initiatorId: currentUser.id,
      initiatorName: currentUser.name,
      initiatorAvatar: currentUser.avatar,
      startedAt: Date.now(),
      participants: [
        {
          userId: currentUser.id,
          name: currentUser.name,
          avatar: currentUser.avatar,
          isMuted: false,
          isCameraOff: type === 'audio',
          isScreenSharing: false,
          joinedAt: Date.now(),
        },
      ],
    };

    setCurrentCall(initialCall);

    if (!isGroup) {
      playCallingRing();
    }

    wsRef.current?.send(
      JSON.stringify({
        type: 'call:initiate',
        callId,
        callType: type,
        isGroup,
        targetId,
        initiator: {
          id: currentUser.id,
          name: currentUser.name,
          avatar: currentUser.avatar,
        },
      })
    );
  };

  // Accept Incoming Call
  const handleAcceptIncomingCall = async () => {
    if (!incomingCallData) return;
    stopRingtone();
    const { callId, callType, caller, isGroup } = incomingCallData;

    const { stream } = await getUserMediaSafe(
      {
        audio: true,
        video: callType === 'video',
      },
      currentUser.name
    );

    const manager = initWebRTCManager(callId);
    manager.setLocalStream(stream);

    setIsCameraOff(callType === 'audio');
    setIsMuted(false);

    const callObj: ActiveCall = {
      callId,
      type: callType,
      isGroup,
      targetId: caller.id,
      initiatorId: caller.id,
      initiatorName: caller.name,
      initiatorAvatar: caller.avatar || '',
      startedAt: Date.now(),
      participants: [
        {
          userId: caller.id,
          name: caller.name,
          avatar: caller.avatar || '',
          isMuted: false,
          isCameraOff: callType === 'audio',
          isScreenSharing: false,
          joinedAt: Date.now(),
        },
        {
          userId: currentUser.id,
          name: currentUser.name,
          avatar: currentUser.avatar,
          isMuted: false,
          isCameraOff: callType === 'audio',
          isScreenSharing: false,
          joinedAt: Date.now(),
        },
      ],
    };

    setCurrentCall(callObj);
    setIncomingCallData(null);
    playCallConnected();

    wsRef.current?.send(
      JSON.stringify({
        type: 'call:join',
        callId,
        user: currentUser,
      })
    );
  };

  // Decline Incoming Call
  const handleDeclineIncomingCall = () => {
    if (!incomingCallData) return;
    stopRingtone();
    wsRef.current?.send(
      JSON.stringify({
        type: 'call:decline',
        callId: incomingCallData.callId,
        recipientId: currentUser.id,
      })
    );
    setIncomingCallData(null);
  };

  // Join Existing Group Room Call
  const handleJoinRoomCall = async (room: Room) => {
    const callId = room.activeCall?.callId || `call-${Date.now()}`;
    const callType = room.activeCall?.callType || 'video';

    const { stream } = await getUserMediaSafe(
      {
        audio: true,
        video: callType === 'video',
      },
      currentUser.name
    );

    const manager = initWebRTCManager(callId);
    manager.setLocalStream(stream);

    const callObj: ActiveCall = {
      callId,
      type: callType,
      isGroup: true,
      targetId: room.id,
      initiatorId: room.createdById,
      initiatorName: room.name,
      initiatorAvatar: '',
      startedAt: Date.now(),
      participants: [
        {
          userId: currentUser.id,
          name: currentUser.name,
          avatar: currentUser.avatar,
          isMuted: false,
          isCameraOff: callType === 'audio',
          isScreenSharing: false,
          joinedAt: Date.now(),
        },
      ],
    };

    setCurrentCall(callObj);
    playCallConnected();

    wsRef.current?.send(
      JSON.stringify({
        type: 'call:join',
        callId,
        user: currentUser,
      })
    );
  };

  // End / Leave Call
  const handleEndCall = () => {
    if (currentCall) {
      wsRef.current?.send(
        JSON.stringify({
          type: 'call:leave',
          callId: currentCall.callId,
          userId: currentUser.id,
        })
      );
    }
    playCallEnded();
    endCallCleanup();
  };

  // Toggle Microphone
  const handleToggleMic = (muted: boolean) => {
    setIsMuted(muted);
    webrtcManagerRef.current?.setAudioMuted(muted);
    if (currentCall) {
      wsRef.current?.send(
        JSON.stringify({
          type: 'call:participant_status',
          callId: currentCall.callId,
          userId: currentUser.id,
          isMuted: muted,
        })
      );
    }
  };

  // Toggle Video
  const handleToggleVideo = (cameraOff: boolean) => {
    setIsCameraOff(cameraOff);
    webrtcManagerRef.current?.setVideoDisabled(cameraOff);
    if (currentCall) {
      wsRef.current?.send(
        JSON.stringify({
          type: 'call:participant_status',
          callId: currentCall.callId,
          userId: currentUser.id,
          isCameraOff: cameraOff,
        })
      );
    }
  };

  // Toggle Screen Sharing
  const handleToggleScreenShare = async (): Promise<boolean> => {
    if (!webrtcManagerRef.current) return false;
    if (isScreenSharing) {
      webrtcManagerRef.current.stopScreenShare();
      setIsScreenSharing(false);
      return false;
    } else {
      const stream = await webrtcManagerRef.current.startScreenShare();
      const active = Boolean(stream);
      setIsScreenSharing(active);
      if (currentCall) {
        wsRef.current?.send(
          JSON.stringify({
            type: 'call:participant_status',
            callId: currentCall.callId,
            userId: currentUser.id,
            isScreenSharing: active,
          })
        );
      }
      return active;
    }
  };

  // Send Message
  const handleSendMessage = (payload: {
    text: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'file';
    voiceAudio?: string;
    voiceDuration?: number;
    replyTo?: { id: string; senderName: string; text: string };
  }) => {
    const isGroup = activeDirectUserId === null;
    const targetId = isGroup ? activeRoomId! : activeDirectUserId!;

    wsRef.current?.send(
      JSON.stringify({
        type: 'chat:send',
        targetId,
        isGroup,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        text: payload.text,
        mediaUrl: payload.mediaUrl,
        mediaType: payload.mediaType,
        voiceAudio: payload.voiceAudio,
        voiceDuration: payload.voiceDuration,
        replyTo: payload.replyTo,
      })
    );
  };

  // Send Reaction
  const handleSendReaction = (messageId: string, emoji: string) => {
    wsRef.current?.send(
      JSON.stringify({
        type: 'chat:reaction',
        messageId,
        emoji,
        userId: currentUser.id,
      })
    );
  };

  // Send Typing
  const handleSendTyping = (isTyping: boolean) => {
    const isGroup = activeDirectUserId === null;
    const targetId = isGroup ? activeRoomId! : activeDirectUserId!;
    wsRef.current?.send(
      JSON.stringify({
        type: 'chat:typing',
        targetId,
        isGroup,
        isTyping,
        userId: currentUser.id,
        userName: currentUser.name,
      })
    );
  };

  // Send in-call chat message
  const handleSendInCallMessage = (text: string) => {
    if (!currentCall) return;
    wsRef.current?.send(
      JSON.stringify({
        type: 'chat:send',
        targetId: currentCall.targetId,
        isGroup: currentCall.isGroup,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        text,
      })
    );
  };

  // Filter messages for active view
  const currentRoom = rooms.find((r) => r.id === activeRoomId) || null;
  const directUser = users.find((u) => u.id === activeDirectUserId) || null;

  const filteredMessages = messages.filter((m) => {
    if (activeDirectUserId) {
      // 1-on-1 DM: either sender is me & target is peer, or sender is peer & target is me
      return (
        !m.isGroup &&
        ((m.senderId === currentUser.id && m.targetId === activeDirectUserId) ||
          (m.senderId === activeDirectUserId && m.targetId === currentUser.id))
      );
    } else {
      // Group Room
      return m.isGroup && m.targetId === activeRoomId;
    }
  });

  const activeTyping = typingUsers.filter(
    (t) => t.targetId === (activeDirectUserId || activeRoomId)
  );

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans text-slate-100 antialiased">
      {/* 3-Zone Top Navigation Contract */}
      <TopNav
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeCalls={activeCalls}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenMultiTab={() => setIsMultiTabOpen(true)}
        isConnected={isConnected}
        onlineCount={users.length}
      />

      {/* Main App Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Real-time Sidebar with Channels & Direct Peers */}
        <Sidebar
          rooms={rooms}
          activeRoomId={activeRoomId}
          onSelectRoom={(roomId) => {
            setActiveRoomId(roomId);
            setActiveDirectUserId(null);
          }}
          users={users}
          currentUserId={currentUser.id}
          activeDirectUserId={activeDirectUserId}
          onSelectDirectUser={(userId) => {
            setActiveDirectUserId(userId);
          }}
          activeCalls={activeCalls}
          onStart1on1Call={(targetUser, type) => {
            setActiveDirectUserId(targetUser.id);
            handleStartCall(type, targetUser);
          }}
          onJoinRoomCall={handleJoinRoomCall}
          onCreateChannelClick={() => setIsCreateChannelOpen(true)}
        />

        {/* Main Workspace: World Map or Live Conversation */}
        {activeTab === 'world-map' ? (
          <WorldMapView
            currentUser={currentUser}
            users={users}
            onStartCall={(targetUser, type) => {
              setActiveDirectUserId(targetUser.id);
              handleStartCall(type, targetUser);
            }}
            onSelectDirectUser={(userId) => {
              setActiveDirectUserId(userId);
              setActiveTab('chats');
            }}
            onJoinRoomCall={handleJoinRoomCall}
            worldStageRoom={rooms.find((r) => r.id === 'world-video-stage') || rooms[1]}
          />
        ) : (
          <ChatArea
            currentUser={currentUser}
            currentRoom={activeDirectUserId ? null : currentRoom}
            directUser={directUser}
            messages={filteredMessages}
            typingUsers={activeTyping}
            onSendMessage={handleSendMessage}
            onSendReaction={handleSendReaction}
            onSendTyping={handleSendTyping}
            onStartCall={(type) => {
              if (activeDirectUserId && directUser) {
                handleStartCall(type, directUser);
              } else if (currentRoom) {
                handleStartCall(type, undefined, currentRoom);
              }
            }}
            onJoinRoomCall={() => {
              if (currentRoom) handleJoinRoomCall(currentRoom);
            }}
          />
        )}
      </div>

      {/* Active Voice / Video Call Modal Interface */}
      {currentCall && (
        <ActiveCallModal
          call={currentCall}
          currentUser={currentUser}
          webrtcManager={webrtcManagerRef.current}
          remoteStreams={remoteStreams}
          speakingPeers={speakingPeers}
          onEndCall={handleEndCall}
          onToggleMic={handleToggleMic}
          onToggleVideo={handleToggleVideo}
          onToggleScreenShare={handleToggleScreenShare}
          isScreenSharing={isScreenSharing}
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          inCallMessages={filteredMessages.slice(-25)}
          onSendInCallMessage={handleSendInCallMessage}
        />
      )}

      {/* Incoming Call Ringing Dialog */}
      {incomingCallData && (
        <IncomingCallModal
          caller={incomingCallData.caller}
          callType={incomingCallData.callType}
          onAccept={handleAcceptIncomingCall}
          onDecline={handleDeclineIncomingCall}
        />
      )}

      {/* Profile & Presence Modal */}
      {isProfileModalOpen && (
        <UserProfileModal
          currentUser={currentUser}
          onClose={() => setIsProfileModalOpen(false)}
          onSave={(updates) => {
            setCurrentUser((prev) => ({
              ...prev,
              ...updates,
            }));
            wsRef.current?.send(
              JSON.stringify({
                type: 'user:update_profile',
                ...updates,
              })
            );
          }}
        />
      )}

      {/* Create Channel Modal */}
      {isCreateChannelOpen && (
        <CreateChannelModal
          onClose={() => setIsCreateChannelOpen(false)}
          onCreate={(name, description, isVoiceVideo) => {
            wsRef.current?.send(
              JSON.stringify({
                type: 'room:create',
                name,
                description,
                isVoiceVideo,
                userId: currentUser.id,
              })
            );
          }}
        />
      )}

      {/* Multi-Tab Testing Helper Modal */}
      {isMultiTabOpen && (
        <MultiTabHelperModal onClose={() => setIsMultiTabOpen(false)} />
      )}
    </div>
  );
}
