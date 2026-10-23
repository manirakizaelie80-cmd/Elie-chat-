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
import { User, Room, Message, ActiveCall, ViewTab, CallSession } from './types';
import { PeerMeshManager } from './utils/peerMesh';
import { getUserMediaSafe } from './utils/mediaFallback';
import { saveUserRealtime, subscribeUsersRealtime, countOnlineUsers } from './utils/userSync';
import { saveRoomRealtime, deleteRoomRealtime, subscribeRoomsRealtime } from './utils/roomSync';
import { 
  saveMessageRealtime, 
  subscribeConversationMessages, 
  subscribeAllMessagesRealtime, 
  markMessagesAsReadRealtime, 
  updateMessageReactionsRealtime, 
  deleteMessageRealtime,
  getConversationId
} from './utils/messageSync';
import {
  startOutgoingCall,
  answerIncomingCall,
  rejectCallSession,
  endCallSession,
  subscribeIncomingCalls,
  ActiveWebRTCSession
} from './utils/firebaseCallSignaling';
import { subscribeAuthState } from './utils/auth';
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
    conversationId: 'room_global-connect',
    targetId: 'global-connect',
    isGroup: true,
    senderId: 'user-elie',
    senderName: 'Elie Manirakiza',
    senderAvatar: '/src/assets/images/avatar_elie_1790670827487.jpg',
    text: 'Muraho and welcome to Elie Chat! 🌍 We connect people living in different locations across the globe with persistent cloud messaging, crisp WebRTC voice calls, and multi-user video stages.',
    status: 'read',
    reactions: { '❤️': ['user-elie'], '🌍': ['user-elie'] },
    timestamp: Date.now() - 3600000 * 3,
  },
  {
    id: 'm-init-2',
    conversationId: 'room_global-connect',
    targetId: 'global-connect',
    isGroup: true,
    senderId: 'user-elena',
    senderName: 'Elena Rostova',
    senderAvatar: '/src/assets/images/avatar_tech_lead_1790668646558.jpg',
    text: 'Greetings from Berlin, Germany! 🇩🇪 Direct WebRTC voice and video calls connect instantly with ultra low latency.',
    status: 'read',
    reactions: { '⚡': ['user-elie'] },
    timestamp: Date.now() - 3600000 * 2,
  },
  {
    id: 'm-init-3',
    conversationId: 'room_global-connect',
    targetId: 'global-connect',
    isGroup: true,
    senderId: 'user-marcus',
    senderName: 'Marcus Vance',
    senderAvatar: '/src/assets/images/avatar_designer_1790668663121.jpg',
    text: 'Good morning from New York, USA! 🇺🇸 Check out the World Map tab or test private 1-on-1 voice & video calling in a second window!',
    status: 'read',
    reactions: { '🚀': ['user-elie'] },
    timestamp: Date.now() - 3600000 * 1,
  },
];

export default function App() {
  // 1. Identify User Session (Persona or Saved Profile)
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

  // Save profile changes to local storage
  useEffect(() => {
    localStorage.setItem('syncwave_current_user', JSON.stringify(currentUser));
  }, [currentUser]);

  // App State
  const [isConnected, setIsConnected] = useState(true);
  const [selfPeerId, setSelfPeerId] = useState<string>('');
  const [users, setUsers] = useState<User[]>(() => [currentUser]);
  const [rooms, setRooms] = useState<Room[]>(DEFAULT_ROOMS);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);

  // Navigation State & Mobile Drawer State
  const [activeTab, setActiveTab] = useState<ViewTab>('chats');
  const [activeRoomId, setActiveRoomId] = useState<string | null>('global-connect');
  const [activeDirectUserId, setActiveDirectUserId] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Typing State
  const [typingUsers, setTypingUsers] = useState<{ userId: string; userName: string; targetId: string }[]>([]);

  // Modals
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [isMultiTabOpen, setIsMultiTabOpen] = useState(false);

  // Incoming Call State
  const [incomingCallData, setIncomingCallData] = useState<{
    callId: string;
    callType: 'audio' | 'video';
    caller: { id: string; name: string; avatar?: string };
    isGroup: boolean;
    targetId: string;
  } | null>(null);

  // Active Call State
  const [currentCall, setCurrentCall] = useState<ActiveCall | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [speakingPeers, setSpeakingPeers] = useState<Record<string, boolean>>({});
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Media & WebRTC references
  const localStreamRef = useRef<MediaStream | null>(null);
  const [localStreamState, setLocalStreamState] = useState<MediaStream | null>(null);
  const activeWebRTCSessionRef = useRef<ActiveWebRTCSession | null>(null);
  const peerMeshRef = useRef<PeerMeshManager | null>(null);

  // Firebase Auth sync listener
  useEffect(() => {
    const unsubscribe = subscribeAuthState((fbUser) => {
      if (fbUser) {
        setCurrentUser((prev) => {
          // If already mapped to same ID, preserve existing custom location
          if (prev.id === fbUser.uid) return prev;
          const updated: User = {
            ...prev,
            id: fbUser.uid,
            name: fbUser.displayName || prev.name,
            email: fbUser.email || undefined,
            avatar: fbUser.photoURL || prev.avatar,
            lastActive: Date.now(),
          };
          saveUserRealtime(updated, selfPeerId).catch(console.error);
          return updated;
        });
      }
    });
    return () => unsubscribe();
  }, [selfPeerId]);

  // Clean up call media and session
  const endCallCleanup = useCallback(() => {
    stopRingtone();
    if (activeWebRTCSessionRef.current) {
      activeWebRTCSessionRef.current.cleanup();
      activeWebRTCSessionRef.current = null;
    }
    if (currentCall) {
      endCallSession(currentCall.callId).catch(() => {});
      if (peerMeshRef.current) {
        peerMeshRef.current.endCall(currentCall.callId);
      }
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStreamState(null);
    setRemoteStreams(new Map());
    setSpeakingPeers({});
    setCurrentCall(null);
    setIsScreenSharing(false);
    setIsMuted(false);
    setIsCameraOff(false);
  }, [currentCall]);

  // Real-Time Firestore Presence: Heartbeat and disconnect handling
  useEffect(() => {
    saveUserRealtime(currentUser, selfPeerId).catch(console.error);

    const interval = setInterval(() => {
      saveUserRealtime(currentUser, selfPeerId).catch(console.error);
    }, 20000);

    const handleBeforeUnload = () => {
      saveUserRealtime({ ...currentUser, status: 'offline' }, selfPeerId).catch(() => {});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUser, selfPeerId]);

  // Real-Time Firestore Presence: Subscribe to all registered users
  useEffect(() => {
    const unsubscribe = subscribeUsersRealtime((firestoreUsers) => {
      setUsers(() => {
        const map = new Map<string, User>();
        // Always include currentUser
        map.set(currentUser.id, currentUser);

        for (const u of firestoreUsers) {
          if (u.id === currentUser.id) continue;
          const isRecentlyActive = typeof u.lastActive === 'number' && Date.now() - u.lastActive < 45000;
          map.set(u.id, {
            ...u,
            status: isRecentlyActive ? (u.status === 'offline' ? 'away' : (u.status || 'online')) : 'offline',
          });
        }
        return Array.from(map.values());
      });
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser.id]);

  // Real-Time Firestore Subscription: Channels & Groups
  useEffect(() => {
    const unsubscribe = subscribeRoomsRealtime((firestoreRooms) => {
      setRooms((prev) => {
        if (firestoreRooms.length === 0) {
          DEFAULT_ROOMS.forEach((r) => saveRoomRealtime(r).catch(console.error));
          return DEFAULT_ROOMS;
        }
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

  // Real-Time Firestore Subscription: Load messages for the currently open conversation
  useEffect(() => {
    const isGroup = activeDirectUserId === null;
    const targetId = isGroup ? activeRoomId : activeDirectUserId;
    if (!targetId) return;

    const conversationId = getConversationId(currentUser.id, targetId, isGroup);

    const unsubscribe = subscribeConversationMessages(
      conversationId,
      (cloudMessages: Message[]) => {
        setMessages((prev) => {
          if (cloudMessages.length === 0) {
            // If empty in Firestore, retain any local initial messages for this room
            const initialForRoom = INITIAL_MESSAGES.filter((m) => m.targetId === targetId);
            return initialForRoom.length > 0 ? initialForRoom : [];
          }
          return cloudMessages;
        });

        // Mark as read in Firestore
        markMessagesAsReadRealtime(cloudMessages, currentUser.id).catch(console.error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [activeRoomId, activeDirectUserId, currentUser.id]);

  // Real-Time Firestore Subscription: Track unread counts across all conversations
  useEffect(() => {
    const unsubscribe = subscribeAllMessagesRealtime((allMessages: Message[]) => {
      const counts: Record<string, number> = {};

      allMessages.forEach((msg: Message) => {
        // Skip messages sent by current user
        if (msg.senderId === currentUser.id) return;

        // Check if current user has read it
        const isRead = msg.readBy && msg.readBy.includes(currentUser.id);
        if (!isRead) {
          const key = msg.isGroup ? msg.targetId : msg.senderId;
          counts[key] = (counts[key] || 0) + 1;
        }
      });

      setUnreadCounts(counts);
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser.id]);

  // Real-Time Firestore Subscription: Incoming WebRTC Call Signaling
  useEffect(() => {
    const unsubscribe = subscribeIncomingCalls(currentUser.id, (call: CallSession) => {
      // If already in a call, reject as busy
      if (currentCall) {
        rejectCallSession(call.id).catch(() => {});
        return;
      }

      playCallingRing();
      setIncomingCallData({
        callId: call.id,
        callType: call.type,
        caller: {
          id: call.callerId,
          name: call.callerName,
          avatar: call.callerAvatar,
        },
        isGroup: call.isGroup,
        targetId: call.callerId,
      });
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser.id, currentCall]);

  // Handle Starting a Call (Real WebRTC with Firestore Signaling)
  const handleStartCall = async (type: 'audio' | 'video', targetUser?: User, room?: Room) => {
    const isGroup = Boolean(room);
    const callId = `call-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const targetId = isGroup ? room!.id : (targetUser?.id || activeDirectUserId!);

    try {
      const { stream } = await getUserMediaSafe(
        {
          audio: true,
          video: type === 'video' ? { facingMode } : false,
        },
        currentUser.name
      );

      localStreamRef.current = stream;
      setLocalStreamState(stream);
      setIsCameraOff(type === 'audio');
      setIsMuted(false);

      if (!isGroup && targetUser) {
        // Direct 1-on-1 WebRTC Call via Firestore Signaling
        playCallingRing();

        const session = await startOutgoingCall({
          callId,
          caller: currentUser,
          receiverId: targetUser.id,
          isGroup: false,
          type,
          localStream: stream,
          onRemoteStream: (remStream) => {
            setRemoteStreams((prev) => new Map(prev).set(targetUser.id, remStream));
          },
          onCallStateChange: (status) => {
            if (status === 'accepted') {
              stopRingtone();
              playCallConnected();
            } else if (status === 'rejected' || status === 'ended') {
              stopRingtone();
              playCallEnded();
              endCallCleanup();
            }
          },
          onCallEnded: () => {
            playCallEnded();
            endCallCleanup();
          },
        });

        activeWebRTCSessionRef.current = session;
      } else if (peerMeshRef.current) {
        // Group Call Stage
        peerMeshRef.current.startCall(callId, type, targetId, isGroup, stream);
      }

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
          ...(targetUser
            ? [
                {
                  userId: targetUser.id,
                  name: targetUser.name,
                  avatar: targetUser.avatar,
                  isMuted: false,
                  isCameraOff: false,
                  isScreenSharing: false,
                  joinedAt: Date.now(),
                },
              ]
            : []),
        ],
      };

      setCurrentCall(initialCall);
    } catch (err) {
      console.error('Failed to initiate call:', err);
      stopRingtone();
    }
  };

  // Accept Incoming WebRTC Call
  const handleAcceptIncomingCall = async () => {
    if (!incomingCallData) return;
    stopRingtone();
    const { callId, callType, caller, isGroup } = incomingCallData;

    try {
      const { stream } = await getUserMediaSafe(
        {
          audio: true,
          video: callType === 'video' ? { facingMode } : false,
        },
        currentUser.name
      );

      localStreamRef.current = stream;
      setLocalStreamState(stream);
      setIsCameraOff(callType === 'audio');
      setIsMuted(false);

      if (!isGroup) {
        // 1-on-1 WebRTC answer via Firestore Signaling
        const session = await answerIncomingCall({
          callId,
          answeringUser: currentUser,
          localStream: stream,
          onRemoteStream: (remStream) => {
            setRemoteStreams((prev) => new Map(prev).set(caller.id, remStream));
          },
          onCallStateChange: (status) => {
            if (status === 'ended') {
              playCallEnded();
              endCallCleanup();
            }
          },
          onCallEnded: () => {
            playCallEnded();
            endCallCleanup();
          },
        });

        activeWebRTCSessionRef.current = session;
      }

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
    } catch (err) {
      console.error('Failed to answer call:', err);
      setIncomingCallData(null);
    }
  };

  // Decline Incoming Call
  const handleDeclineIncomingCall = () => {
    if (!incomingCallData) return;
    stopRingtone();
    rejectCallSession(incomingCallData.callId).catch(() => {});
    setIncomingCallData(null);
  };

  // Join Existing Group Room Call
  const handleJoinRoomCall = async (room: Room) => {
    const callId = room.activeCall?.callId || `call-${room.id}-${Date.now()}`;
    const callType = room.activeCall?.callType || 'video';

    const { stream } = await getUserMediaSafe(
      {
        audio: true,
        video: callType === 'video' ? { facingMode } : false,
      },
      currentUser.name
    );

    localStreamRef.current = stream;
    setLocalStreamState(stream);
    setIsCameraOff(callType === 'audio');
    setIsMuted(false);

    if (peerMeshRef.current) {
      peerMeshRef.current.joinGroupRoomCall(callId, room.id, stream);
    }

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
    playCallEnded();
    endCallCleanup();
  };

  // Toggle Microphone
  const handleToggleMic = (muted: boolean) => {
    setIsMuted(muted);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  };

  // Toggle Video Camera
  const handleToggleVideo = (cameraOff: boolean) => {
    setIsCameraOff(cameraOff);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !cameraOff;
      });
    }
  };

  // Switch Front / Back Camera (Mobile Support)
  const handleSwitchCamera = async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);

    try {
      const newMedia = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { exact: nextMode } },
      });
      const newVideoTrack = newMedia.getVideoTracks()[0];

      if (localStreamRef.current && newVideoTrack) {
        const oldTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldTrack) {
          localStreamRef.current.removeTrack(oldTrack);
          oldTrack.stop();
        }
        localStreamRef.current.addTrack(newVideoTrack);
        setLocalStreamState(new MediaStream(localStreamRef.current.getTracks()));

        // Replace track in active RTCPeerConnection if active
        if (activeWebRTCSessionRef.current) {
          const pc = activeWebRTCSessionRef.current.peerConnection;
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(newVideoTrack).catch(console.error);
          }
        }
      }
    } catch (err) {
      console.warn('Could not flip camera to mode:', nextMode, err);
    }
  };

  // Toggle Screen Sharing
  const handleToggleScreenShare = async (): Promise<boolean> => {
    if (isScreenSharing) {
      setIsScreenSharing(false);
      // Revert back to camera if active
      return false;
    } else {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = displayStream.getVideoTracks()[0];

        if (localStreamRef.current && screenTrack) {
          const oldTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldTrack) {
            localStreamRef.current.removeTrack(oldTrack);
            oldTrack.stop();
          }
          localStreamRef.current.addTrack(screenTrack);
          setLocalStreamState(new MediaStream(localStreamRef.current.getTracks()));

          if (activeWebRTCSessionRef.current) {
            const pc = activeWebRTCSessionRef.current.peerConnection;
            const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
            if (sender) {
              sender.replaceTrack(screenTrack).catch(console.error);
            }
          }

          screenTrack.onended = () => {
            setIsScreenSharing(false);
          };
          setIsScreenSharing(true);
          return true;
        }
      } catch (err) {
        console.warn('Screen share canceled or failed', err);
      }
      return false;
    }
  };

  // Create Channel / Group
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

    setRooms((prev) => [...prev.filter((r) => r.id !== newRoom.id), newRoom]);
    setActiveRoomId(newRoom.id);
    setActiveDirectUserId(null);
    setIsMobileSidebarOpen(false);

    await saveRoomRealtime(newRoom).catch(console.error);
  };

  // Delete Room
  const handleDeleteRoom = async (roomId: string) => {
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
    if (activeRoomId === roomId) {
      setActiveRoomId('global-connect');
    }
    await deleteRoomRealtime(roomId).catch(console.error);
  };

  // Send Message (Real Firestore Cloud Persistence)
  const handleSendMessage = async (payload: {
    text: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'file';
    voiceAudio?: string;
    voiceDuration?: number;
    replyTo?: { id: string; senderName: string; text: string };
  }) => {
    const isGroup = activeDirectUserId === null;
    const targetId = isGroup ? activeRoomId! : activeDirectUserId!;
    const conversationId = getConversationId(currentUser.id, targetId, isGroup);

    const newMsg: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      conversationId,
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
      status: 'delivered',
      readBy: [currentUser.id],
      reactions: {},
      timestamp: Date.now(),
    };

    // Optimistically show in UI
    setMessages((prev) => [...prev, newMsg]);

    // Persist permanently in Firestore
    await saveMessageRealtime(newMsg).catch(console.error);
  };

  // Send Reaction (Real Firestore Persistence)
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
        updateMessageReactionsRealtime(messageId, nextReactions).catch(console.error);
        return { ...m, reactions: nextReactions };
      })
    );
  };

  // Send Typing Indicator
  const handleSendTyping = (isTyping: boolean) => {
    const isGroup = activeDirectUserId === null;
    const targetId = isGroup ? activeRoomId! : activeDirectUserId!;
    if (peerMeshRef.current) {
      peerMeshRef.current.sendTyping(targetId, isGroup, isTyping);
    }
  };

  // Send in-call chat message
  const handleSendInCallMessage = async (text: string) => {
    if (!currentCall) return;
    const isGroup = currentCall.isGroup;
    const targetId = currentCall.targetId;
    const conversationId = getConversationId(currentUser.id, targetId, isGroup);

    const newMsg: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      conversationId,
      targetId,
      isGroup,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      text,
      status: 'delivered',
      readBy: [currentUser.id],
      reactions: {},
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, newMsg]);
    await saveMessageRealtime(newMsg).catch(console.error);
  };

  // Filter messages for current active room or direct user
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

  // Calculate real deduplicated online users count
  const realOnlineCount = countOnlineUsers(users);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans text-slate-100 antialiased">
      {/* 3-Zone Top Navigation */}
      <TopNav
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeCalls={activeCalls}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenMultiTab={() => setIsMultiTabOpen(true)}
        isConnected={isConnected}
        onlineCount={realOnlineCount}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        isMobileSidebarOpen={isMobileSidebarOpen}
      />

      {/* Main App Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Real-time Sidebar with Channels, Direct Peers, and Unread Counts */}
        <Sidebar
          rooms={rooms}
          activeRoomId={activeRoomId}
          onSelectRoom={(roomId) => {
            setActiveRoomId(roomId);
            setActiveDirectUserId(null);
            setIsMobileSidebarOpen(false);
          }}
          users={users}
          currentUserId={currentUser.id}
          activeDirectUserId={activeDirectUserId}
          onSelectDirectUser={(userId) => {
            setActiveDirectUserId(userId);
            setIsMobileSidebarOpen(false);
          }}
          activeCalls={activeCalls}
          onStart1on1Call={(targetUser, type) => {
            setActiveDirectUserId(targetUser.id);
            handleStartCall(type, targetUser);
          }}
          onJoinRoomCall={handleJoinRoomCall}
          onCreateChannelClick={() => setIsCreateChannelOpen(true)}
          onDeleteRoom={handleDeleteRoom}
          unreadCounts={unreadCounts}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
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
            onDeleteMessage={(msgId) => {
              deleteMessageRealtime(msgId).catch(console.error);
              setMessages((prev) => prev.filter((m) => m.id !== msgId));
            }}
            onBackToSidebar={() => setIsMobileSidebarOpen(true)}
          />
        )}
      </div>

      {/* Active Voice / Video Call Modal Interface */}
      {currentCall && (
        <ActiveCallModal
          call={currentCall}
          currentUser={currentUser}
          webrtcManager={peerMeshRef.current}
          localStream={localStreamState}
          remoteStreams={remoteStreams}
          speakingPeers={speakingPeers}
          onEndCall={handleEndCall}
          onToggleMic={handleToggleMic}
          onToggleVideo={handleToggleVideo}
          onSwitchCamera={handleSwitchCamera}
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
