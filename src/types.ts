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
  status: 'online' | 'away' | 'busy' | 'in-call';
  customStatus?: string;
  location?: UserLocation;
  lastActive: number;
}

export interface Message {
  id: string;
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

export type ViewTab = 'chats' | 'rooms' | 'direct' | 'world-map' | 'active-calls';
