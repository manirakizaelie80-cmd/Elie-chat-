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
import { PeerMeshManager } from './utils/peerMesh';
import { getUserMediaSafe } from './utils/mediaFallback';
import { saveUserRealtime, subscribeUsersRealtime } from './utils/userSync';
import { saveRoomRealtime, deleteRoomRealtime, subscribeRoomsRealtime } from './utils/roomSync';
import { 
  playCallingRing, 
  playCallConnected, 
  playCallEnded, 
  playMessageNotification, 
  stopRingtone 
} from './utils/audioSynth';

const DEFAULT_ROOMS: Room[] = [
  {
    id: 'global-connect',
    name: 'Elie Chat Global Hub',
    description: 'Connecting people across all continents. Live chat, culture exchange, and cross-border syncs.',
    type: 'text',
    createdById: 'user-elie',
    createdAt: Date.now() - 3600000 * 24,
  },
  {
    id: 'world-video-stage',
    name: 'World Video Stage 🌍',
    description: '24/7 Live multi-user video stage bridging Kigali, New York, Berlin, Tokyo & worldwide.',
    type: 'voice-video',
    createdById: 'user-elie',
    createdAt: Date.now() - 3600000 * 24,
  },
  {
    id: 'kigali-africa',
    name: 'Kigali & Pan-Africa Hub',
    description: 'Rwanda, East Africa, and pan-African technology & culture connection.',
    type: 'text',
    createdById: 'user-elie',
    createdAt: Date.now() - 3600000 * 20,
  },
  {
    id: 'global-voice-lounge',
    name: 'Global Voice Lounge 🎙️',
    description: 'Drop-in worldwide audio room. Hear voices from different continents in real time.',
    type: 'voice-video',
    createdById: 'user-elie',
    createdAt: Date.now() - 3600000 * 18,
  },
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'm-init-1',
    targetId: 'global-connect',
    isGroup: true,
    senderId: 'user-elie',
    senderName: 'Elie Manirakiza',
    senderAvatar: '/src/assets/images/avatar_elie_1790670827487.jpg',
    text: 'Muraho and welcome to Elie Chat! 🌍 We connect people living in different locations across the globe with serverless P2P messaging, crisp voice calls, and multi-user video stages powered by public PeerJS cloud signaling.',
    reactions: { '❤️': ['user-elie'], '🌍': ['user-elie'] },
    timestamp: Date.now() - 3600000 * 3,
  },
  {
    id: 'm-init-2',
    targetId: 'global-connect',
    isGroup: true,
    senderId: 'user-elena',
    senderName: 'Elena Rostova',
    senderAvatar: '/src/assets/images/avatar_tech_lead_1790668646558.jpg',
    text: 'Greetings from Berlin, Germany! 🇩🇪 Even across 6,000+ kilometers, peer-to-peer WebRTC connections are direct, private, and ultra low latency.',
    reactions: { '⚡': ['user-elie'] },
    timestamp: Date.now() - 3600000 * 2,
  },
  {
    id: 'm-init-3',
    targetId: 'global-connect',
    isGroup: true,
    senderId: 'user-marcus',
    senderName: 'Marcus Vance',
    senderAvatar: '/src/assets/images/avatar_designer_1790668663121.jpg',
    text: 'Good morning from New York, USA! 🇺🇸 Check out the World Map tab at the top or open another tab as a test peer to see direct P2P discovery in action!',
    reactions: { '🚀': ['user-elie'] },
    timestamp: Date.now() - 3600000 * 1,
  },
  {
    id: 'm-init-4',
    targetId: 'world-video-stage',
    isGroup: true,
    senderId: 'user-elie',
    senderName: 'Elie Manirakiza',
    senderAvatar: '/src/assets/images/avatar_elie_1790670827487.jpg',
    text: 'Jump into the World Video Stage above to experience live group video conference with participants anywhere in the world!',
    reactions: { '🎥': ['user-marcus'] },
    timestamp: Date.now() - 3600000 * 1,
  },
];

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
        if (parsed.location && parsed.id) return parsed;
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

  // App State: users initialized with currentUser
  const [isConnected, setIsConnected] = useState(false);
  const [selfPeerId, setSelfPeerId] = useState<string>('');
  const [users, setUsers] = useState<User[]>(() => [currentUser]);
  const [rooms, setRooms] = useState<Room[]>(DEFAULT_ROOMS);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
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
    targetId: string;
  } | null>(null);

  // Current Active Call
  const [currentCall, setCurrentCall] = useState<ActiveCall | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [speakingPeers, setSpeakingPeers] = useState<Record<string, boolean>>({});

  // P2P PeerJS Mesh Manager Ref
  const peerMeshRef = useRef<PeerMeshManager | null>(null);

  // Clean up call
  const endCallCleanup = useCallback(() => {
    stopRingtone();
    if (peerMeshRef.current && currentCall) {
      peerMeshRef.current.endCall(currentCall.callId);
    }
    setRemoteStreams(new Map());
    setSpeakingPeers({});
    setCurrentCall(null);
    setIsScreenSharing(false);
    setIsMuted(false);
    setIsCameraOff(false);
  }, [currentCall]);

  // Initialize PeerJS Mesh Manager with public PeerJS cloud server (new Peer())
  useEffect(() => {
    const mesh = new PeerMeshManager(currentUser, {
      onSelfPeerId: (peerId) => {
        setSelfPeerId(peerId);
        setIsConnected(true);
      },

      onUserJoined: (user) => {
        // When another user connects, add them to users state
        setUsers((prev) => {
          const map = new Map<string, User>();
          for (const u of prev) {
            map.set(u.id, u);
          }
          map.set(user.id, {
            ...user,
            status: 'online',
          });
          map.set(currentUser.id, currentUser);
          return Array.from(map.values());
        });
      },

      onUserLeft: (userId) => {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, status: 'away' } : u))
        );
      },

      onUsersSync: (syncedUsers) => {
        // Update user state so another user is shown as online
        setUsers(() => {
          const map = new Map<string, User>();
          map.set(currentUser.id, currentUser);
          for (const u of syncedUsers) {
            if (u.id !== currentUser.id) {
              map.set(u.id, {
                ...u,
                status: 'online',
              });
            }
          }
          return Array.from(map.values());
        });
      },

      onNewMessage: (msg) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });

        if (msg.senderId !== currentUser.id) {
          playMessageNotification();
        }
      },

      onReactionUpdated: (messageId, reactions) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
        );
      },

      onTyping: (userId, userName, targetId, isTyping) => {
        if (isTyping) {
          setTypingUsers((prev) => {
            if (prev.some((t) => t.userId === userId && t.targetId === targetId)) return prev;
            return [...prev, { userId, userName, targetId }];
          });
        } else {
          setTypingUsers((prev) =>
            prev.filter((t) => !(t.userId === userId && t.targetId === targetId))
          );
        }
      },

      onIncomingCall: (callData) => {
        playCallingRing();
        setIncomingCallData({
          callId: callData.callId,
          callType: callData.callType,
          caller: callData.caller,
          isGroup: callData.isGroup,
          targetId: callData.targetId,
        });
      },

      onCallAccepted: () => {
        stopRingtone();
        playCallConnected();
      },

      onCallRejected: () => {
        stopRingtone();
        endCallCleanup();
      },

      onCallParticipantJoined: (callId, participant) => {
        setCurrentCall((curr) => {
          if (!curr || curr.callId !== callId) return curr;
          const exists = curr.participants.some((p) => p.userId === participant.userId);
          if (exists) return curr;
          return {
            ...curr,
            participants: [...curr.participants, participant],
          };
        });
      },

      onCallParticipantLeft: (callId, userId) => {
        setCurrentCall((curr) => {
          if (!curr || curr.callId !== callId) return curr;
          return {
            ...curr,
            participants: curr.participants.filter((p) => p.userId !== userId),
          };
        });
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(userId);
          return next;
        });
      },

      onCallParticipantStatus: (callId, userId, status) => {
        setCurrentCall((curr) => {
          if (!curr || curr.callId !== callId) return curr;
          return {
            ...curr,
            participants: curr.participants.map((p) =>
              p.userId === userId ? { ...p, ...status } : p
            ),
          };
        });
      },

      onCallEnded: (callId) => {
        if (currentCall && currentCall.callId === callId) {
          playCallEnded();
          endCallCleanup();
        }
      },

      onRemoteStream: (peerId, stream) => {
        setRemoteStreams((prev) => new Map(prev).set(peerId, stream));
      },

      onRemoteStreamRemoved: (peerId) => {
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(peerId);
          return next;
        });
      },

      onPeerSpeaking: (peerId, isSpeaking) => {
        setSpeakingPeers((prev) => ({ ...prev, [peerId]: isSpeaking }));
      },

      onRoomCreated: (newRoom) => {
        setRooms((prev) => {
          if (prev.some((r) => r.id === newRoom.id)) return prev;
          return [...prev, newRoom];
        });
      },
    });

    peerMeshRef.current = mesh;

    return () => {
      mesh.destroy();
      peerMeshRef.current = null;
    };
  }, [currentUser.id]);

  // Real-Time Firestore Persistence: Save user information to Firestore in real time
  useEffect(() => {
    saveUserRealtime(currentUser, selfPeerId).catch(console.error);

    // Periodic heartbeat to Firestore every 25 seconds
    const interval = setInterval(() => {
      saveUserRealtime(currentUser, selfPeerId).catch(console.error);
    }, 25000);

    const handleBeforeUnload = () => {
      saveUserRealtime({ ...currentUser, status: 'away' }, selfPeerId);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUser, selfPeerId]);

  // Real-Time Firestore Subscription: Listen to all users saved in the cloud in real time
  useEffect(() => {
    const unsubscribe = subscribeUsersRealtime((firestoreUsers) => {
      setUsers((prev) => {
        const map = new Map<string, User>();
        // Always include currentUser
        map.set(currentUser.id, currentUser);

        // Include all users from Firestore
        for (const u of firestoreUsers) {
          if (u.id === currentUser.id) continue;
          const isRecentlyActive = Date.now() - (u.lastActive || 0) < 90000;
          map.set(u.id, {
            ...u,
            status: isRecentlyActive ? (u.status || 'online') : 'away',
          });

          // If they have a registered PeerJS ID, auto-connect via WebRTC mesh
          const userWithPeerId = u as any;
          if (userWithPeerId.peerId && userWithPeerId.peerId !== selfPeerId) {
            peerMeshRef.current?.connectToPeer(userWithPeerId.peerId, u);
          }
        }

        // Merge any peers already connected via WebRTC
        for (const p of prev) {
          if (!map.has(p.id)) {
            map.set(p.id, p);
          }
        }

        return Array.from(map.values());
      });
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser.id, selfPeerId]);

  // Real-Time Firestore Subscription: Listen to all channels & groups in the cloud in real time
  useEffect(() => {
    const unsubscribe = subscribeRoomsRealtime((firestoreRooms) => {
      setRooms((prev) => {
        if (firestoreRooms.length === 0) {
          // Seed default rooms to Firestore if empty
          DEFAULT_ROOMS.forEach((r) => saveRoomRealtime(r).catch(console.error));
          return DEFAULT_ROOMS;
        }
        // Merge default rooms with user-created channels and custom groups
        const map = new Map<string, Room>();
        DEFAULT_ROOMS.forEach((r) => map.set(r.id, r));
        firestoreRooms.forEach((r) => map.set(r.id, r));
        return Array.from(map.values());
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Handle Creating a Custom Group or Channel
  const handleCreateRoom = async (roomData: {
    name: string;
    description: string;
    type: 'text' | 'voice-video';
    isCustomGroup: boolean;
    icon?: string;
    category?: string;
    memberIds?: string[];
  }) => {
    const newRoom: Room = {
      id: `room-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: roomData.name,
      description: roomData.description,
      type: roomData.type,
      isCustomGroup: roomData.isCustomGroup,
      icon: roomData.icon,
      category: roomData.category,
      memberIds: roomData.memberIds,
      createdById: currentUser.id,
      createdByName: currentUser.name,
      createdAt: Date.now(),
    };

    // Optimistically add to state and switch to new room
    setRooms((prev) => [...prev.filter((r) => r.id !== newRoom.id), newRoom]);
    setActiveRoomId(newRoom.id);
    setActiveDirectUserId(null);

    // Persist to Firestore in real time
    await saveRoomRealtime(newRoom).catch(console.error);

    // Announce to P2P mesh
    peerMeshRef.current?.createRoom(newRoom);
  };

  // Handle Deleting a Room / Group
  const handleDeleteRoom = async (roomId: string) => {
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
    if (activeRoomId === roomId) {
      setActiveRoomId('global-connect');
    }
    await deleteRoomRealtime(roomId).catch(console.error);
  };

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

    setIsCameraOff(type === 'audio');
    setIsMuted(false);

    peerMeshRef.current?.startCall(callId, type, targetId, isGroup, stream);

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

    setIsCameraOff(callType === 'audio');
    setIsMuted(false);

    peerMeshRef.current?.acceptCall(callId, stream);

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
  };

  // Decline Incoming Call
  const handleDeclineIncomingCall = () => {
    if (!incomingCallData) return;
    stopRingtone();
    peerMeshRef.current?.rejectCall(incomingCallData.callId, currentUser.id);
    setIncomingCallData(null);
  };

  // Join Existing Group Room Call
  const handleJoinRoomCall = async (room: Room) => {
    const callId = room.activeCall?.callId || `call-${room.id}-${Date.now()}`;
    const callType = room.activeCall?.callType || 'video';

    const { stream } = await getUserMediaSafe(
      {
        audio: true,
        video: callType === 'video',
      },
      currentUser.name
    );

    setIsCameraOff(callType === 'audio');
    setIsMuted(false);

    peerMeshRef.current?.joinGroupRoomCall(callId, room.id, stream);

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
  };

  // End / Leave Call
  const handleEndCall = () => {
    if (currentCall) {
      peerMeshRef.current?.endCall(currentCall.callId);
    }
    playCallEnded();
    endCallCleanup();
  };

  // Toggle Microphone
  const handleToggleMic = (muted: boolean) => {
    setIsMuted(muted);
    peerMeshRef.current?.setAudioMuted(muted);
    if (currentCall) {
      peerMeshRef.current?.broadcastToDataChannels({
        type: 'call:participant_status',
        callId: currentCall.callId,
        userId: currentUser.id,
        isMuted: muted,
      });
    }
  };

  // Toggle Video
  const handleToggleVideo = (cameraOff: boolean) => {
    setIsCameraOff(cameraOff);
    peerMeshRef.current?.setVideoDisabled(cameraOff);
    if (currentCall) {
      peerMeshRef.current?.broadcastToDataChannels({
        type: 'call:participant_status',
        callId: currentCall.callId,
        userId: currentUser.id,
        isCameraOff: cameraOff,
      });
    }
  };

  // Toggle Screen Sharing
  const handleToggleScreenShare = async (): Promise<boolean> => {
    if (!peerMeshRef.current) return false;
    if (isScreenSharing) {
      peerMeshRef.current.stopScreenShare();
      setIsScreenSharing(false);
      return false;
    } else {
      const stream = await peerMeshRef.current.startScreenShare();
      const active = Boolean(stream);
      setIsScreenSharing(active);
      if (currentCall) {
        peerMeshRef.current.broadcastToDataChannels({
          type: 'call:participant_status',
          callId: currentCall.callId,
          userId: currentUser.id,
          isScreenSharing: active,
        });
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

    const newMsg: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
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
      reactions: {},
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, newMsg]);
    peerMeshRef.current?.sendMessage(newMsg);
  };

  // Send Reaction
  const handleSendReaction = (messageId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const currentUsers = m.reactions[emoji] || [];
        const hasReacted = currentUsers.includes(currentUser.id);
        const nextUsers = hasReacted
          ? currentUsers.filter((id) => id !== currentUser.id)
          : [...currentUsers, currentUser.id];
        const nextReactions = { ...m.reactions, [emoji]: nextUsers };
        if (nextUsers.length === 0) {
          delete nextReactions[emoji];
        }
        peerMeshRef.current?.sendReaction(messageId, nextReactions);
        return { ...m, reactions: nextReactions };
      })
    );
  };

  // Send Typing
  const handleSendTyping = (isTyping: boolean) => {
    const isGroup = activeDirectUserId === null;
    const targetId = isGroup ? activeRoomId! : activeDirectUserId!;
    peerMeshRef.current?.sendTyping(targetId, isGroup, isTyping);
  };

  // Send in-call chat message
  const handleSendInCallMessage = (text: string) => {
    if (!currentCall) return;
    const isGroup = currentCall.isGroup;
    const targetId = currentCall.targetId;

    const newMsg: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      targetId,
      isGroup,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      text,
      reactions: {},
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, newMsg]);
    peerMeshRef.current?.sendMessage(newMsg);
  };

  // Filter messages for active view
  const currentRoom = rooms.find((r) => r.id === activeRoomId) || null;
  const directUser = users.find((u) => u.id === activeDirectUserId) || null;

  const filteredMessages = messages.filter((m) => {
    if (activeDirectUserId) {
      return (
        !m.isGroup &&
        ((m.senderId === currentUser.id && m.targetId === activeDirectUserId) ||
          (m.senderId === activeDirectUserId && m.targetId === currentUser.id))
      );
    } else {
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
          onDeleteRoom={handleDeleteRoom}
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
            onDeleteRoom={handleDeleteRoom}
          />
        )}
      </div>

      {/* Active Voice / Video Call Modal Interface */}
      {currentCall && (
        <ActiveCallModal
          call={currentCall}
          currentUser={currentUser}
          webrtcManager={peerMeshRef.current}
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
            const updated = {
              ...currentUser,
              ...updates,
            };
            setCurrentUser(updated);
            peerMeshRef.current?.updateCurrentUser(updated);
            saveUserRealtime(updated, selfPeerId).catch(console.error);
          }}
        />
      )}

      {/* Create Channel Modal */}
      {isCreateChannelOpen && (
        <CreateChannelModal
          onClose={() => setIsCreateChannelOpen(false)}
          onCreate={handleCreateRoom}
          availableUsers={users}
          currentUserId={currentUser.id}
        />
      )}

      {/* Multi-Tab Testing Helper Modal */}
      {isMultiTabOpen && (
        <MultiTabHelperModal
          onClose={() => setIsMultiTabOpen(false)}
          selfPeerId={selfPeerId}
          onSwitchPersona={(personaKey) => {
            const url = new URL(window.location.href);
            url.searchParams.set('persona', personaKey);
            window.location.href = url.toString();
          }}
        />
      )}
    </div>
  );
}
