export interface UserLocation {
  city: string;
  country: string;
  flag: string;
  timezone: string;
  lat: number;
  lng: number;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  email?: string;
  status: 'online' | 'away' | 'busy' | 'in-call' | 'offline';
  customStatus?: string;
  location?: UserLocation;
  peerId?: string;
  lastActive: number;
  lastSeen?: number;
}

export interface Message {
  id: string;
  conversationId: string; // for 1-on-1: userA__userB (sorted), for rooms: room__roomId
  targetId: string; // roomId or recipient userId
  isGroup: boolean;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'file';
  voiceAudio?: string;
  voiceDuration?: number;
  reactions: Record<string, string[]>;
  replyTo?: {
    id: string;
    senderName: string;
    text: string;
  };
  status?: 'sent' | 'delivered' | 'read';
  readBy?: string[];
  timestamp: number;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  type: 'text' | 'voice-video';
  createdById: string;
  createdByName?: string;
  createdAt: number;
  category?: string;
  icon?: string;
  isCustomGroup?: boolean;
  isPrivate?: boolean;
  memberIds?: string[];
  activeCall?: {
    callId: string;
    callType: 'audio' | 'video';
    startedAt: number;
    participants: string[];
  };
}

export interface CallParticipant {
  userId: string;
  name: string;
  avatar: string;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  joinedAt: number;
}

export interface ActiveCall {
  callId: string;
  type: 'audio' | 'video';
  isGroup: boolean;
  targetId: string;
  initiatorId: string;
  initiatorName: string;
  initiatorAvatar: string;
  startedAt: number;
  participants: CallParticipant[];
}

export interface CallSession {
  id: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  receiverId: string;
  isGroup: boolean;
  type: 'audio' | 'video';
  status: 'calling' | 'ringing' | 'accepted' | 'rejected' | 'busy' | 'ended';
  offer?: any;
  answer?: any;
  createdAt: number;
  endedAt?: number;
}

export type ViewTab = 'chats' | 'rooms' | 'direct' | 'world-map' | 'active-calls';
