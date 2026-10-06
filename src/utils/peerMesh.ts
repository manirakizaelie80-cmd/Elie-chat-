import Peer, { DataConnection, MediaConnection } from 'peerjs';
import { User, Message, Room, ActiveCall, CallParticipant } from '../types';

export interface PeerMeshCallbacks {
  onSelfPeerId: (peerId: string) => void;
  onUserJoined: (user: User) => void;
  onUserLeft: (userId: string) => void;
  onUsersSync: (users: User[]) => void;
  onNewMessage: (message: Message) => void;
  onReactionUpdated: (messageId: string, reactions: Record<string, string[]>) => void;
  onTyping: (userId: string, userName: string, targetId: string, isTyping: boolean) => void;
  onIncomingCall: (callData: {
    callId: string;
    callType: 'audio' | 'video';
    caller: { id: string; name: string; avatar?: string };
    isGroup: boolean;
    targetId: string;
  }) => void;
  onCallAccepted: (callId: string) => void;
  onCallRejected: (callId: string) => void;
  onCallParticipantJoined: (callId: string, participant: CallParticipant) => void;
  onCallParticipantLeft: (callId: string, userId: string) => void;
  onCallParticipantStatus: (callId: string, userId: string, status: { isMuted?: boolean; isCameraOff?: boolean; isScreenSharing?: boolean }) => void;
  onCallEnded: (callId: string) => void;
  onRemoteStream: (peerId: string, stream: MediaStream) => void;
  onRemoteStreamRemoved: (peerId: string) => void;
  onPeerSpeaking: (peerId: string, isSpeaking: boolean) => void;
  onRoomCreated: (room: Room) => void;
}

const KNOWN_PERSONA_IDS = [
  'syncwave-user-elie',
  'syncwave-user-marcus',
  'syncwave-user-elena',
  'syncwave-user-kenji',
];

const DISCOVERY_TOPIC = 'syncwave-elie-chat-global-discovery-v2';

export class PeerMeshManager {
  private peer: Peer | null = null;
  private selfPeerId: string = '';
  private currentUser: User;
  private callbacks: PeerMeshCallbacks;
  
  // Active DataConnections: map peerId -> DataConnection
  private dataConnections: Map<string, DataConnection> = new Map();
  
  // Active MediaConnections: map peerId -> MediaConnection
  private mediaConnections: Map<string, MediaConnection> = new Map();

  // Known online peers: map userId -> { user: User, peerId: string, lastSeen: number }
  private connectedPeers: Map<string, { user: User; peerId: string; lastSeen: number }> = new Map();
  
  // Local audio and media
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private localAudioCtx: AudioContext | null = null;
  private audioAnalyzers: Map<string, { analyser: AnalyserNode; intervalId: any }> = new Map();
  
  // Multi-tab broadcast channel
  private broadcastChannel: BroadcastChannel | null = null;
  
  // Discovery PubSub WebSocket (ntfy.sh)
  private discoveryWs: WebSocket | null = null;
  private heartbeatInterval: any = null;
  private isDestroyed: boolean = false;

  constructor(currentUser: User, callbacks: PeerMeshCallbacks) {
    this.currentUser = currentUser;
    this.callbacks = callbacks;
    this.init();
  }

  public updateCurrentUser(user: User) {
    this.currentUser = user;
    // Broadcast updated profile to all connected peers
    this.broadcastToDataChannels({
      type: 'presence:update',
      user: this.currentUser,
      peerId: this.selfPeerId,
    });
    this.publishDiscoveryAnnounce();
  }

  private init() {
    this.initBroadcastChannel();
    this.initPeerJS();
    this.initDiscoveryPubSub();
    this.startHeartbeat();
  }

  // 1. Initialize PeerJS using free public cloud server (0.peerjs.com)
  private initPeerJS() {
    const preferredId = `syncwave-${this.currentUser.id}`;

    const createPeerInstance = (idToUse?: string) => {
      // By default new Peer() connects to the free public PeerJS Cloud Server (0.peerjs.com)
      const options: any = {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
          ],
        },
      };

      const peerInstance = idToUse ? new Peer(idToUse, options) : new Peer(options);

      peerInstance.on('open', (id) => {
        console.log(`[PeerJS Cloud] Peer registered dynamically with ID: ${id}`);
        this.selfPeerId = id;
        this.callbacks.onSelfPeerId(id);

        // Save self and probe other peers
        this.publishDiscoveryAnnounce();
        this.probeKnownPeers();
      });

      peerInstance.on('connection', (conn) => {
        console.log(`[PeerJS] Incoming DataConnection from ${conn.peer}`);
        this.setupDataConnection(conn);
      });

      peerInstance.on('call', (mediaConn) => {
        console.log(`[PeerJS] Incoming MediaConnection (Call) from ${mediaConn.peer}`);
        this.setupIncomingMediaConnection(mediaConn);
      });

      peerInstance.on('error', (err: any) => {
        console.warn('[PeerJS] Error event:', err.type, err.message);

        // If preferred ID is taken (e.g. same user in another tab), fall back to unique ID
        if (err.type === 'unavailable-id' && idToUse) {
          console.log('[PeerJS] Preferred ID unavailable. Re-registering with unique dynamic ID...');
          peerInstance.destroy();
          const fallbackId = `${idToUse}-${Math.floor(1000 + Math.random() * 9000)}`;
          createPeerInstance(fallbackId);
        }
      });

      peerInstance.on('disconnected', () => {
        console.log('[PeerJS] Disconnected from signaling server. Attempting reconnect...');
        if (!this.isDestroyed && peerInstance && !peerInstance.destroyed) {
          try {
            peerInstance.reconnect();
          } catch (e) {
            console.warn('[PeerJS] Reconnect failed:', e);
          }
        }
      });

      this.peer = peerInstance;
    };

    createPeerInstance(preferredId);
  }

  // 2. Cross-tab instant discovery via BroadcastChannel
  private initBroadcastChannel() {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel('syncwave_peer_mesh_discovery');
        this.broadcastChannel.onmessage = (event) => {
          const data = event.data;
          if (!data || data.peerId === this.selfPeerId) return;

          if (data.type === 'ANNOUNCE') {
            if (data.user && data.peerId) {
              this.connectToPeer(data.peerId, data.user);
            }
          } else if (data.type === 'QUERY_PEERS') {
            if (this.selfPeerId) {
              this.broadcastChannel?.postMessage({
                type: 'ANNOUNCE',
                peerId: this.selfPeerId,
                user: this.currentUser,
              });
            }
          }
        };

        // Query any existing tabs
        this.broadcastChannel.postMessage({ type: 'QUERY_PEERS' });
      }
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }
  }

  // 3. Free Public Cross-Device Discovery PubSub (ntfy.sh WebSocket)
  private initDiscoveryPubSub() {
    const connectPubSub = () => {
      if (this.isDestroyed) return;
      try {
        const wsUrl = `wss://ntfy.sh/${DISCOVERY_TOPIC}/ws`;
        const ws = new WebSocket(wsUrl);
        this.discoveryWs = ws;

        ws.onopen = () => {
          // Announce presence once open
          this.publishDiscoveryAnnounce();
        };

        ws.onmessage = (event) => {
          try {
            const raw = JSON.parse(event.data);
            if (raw.event === 'message' && raw.message) {
              const payload = JSON.parse(raw.message);
              if (payload.peerId && payload.peerId !== this.selfPeerId) {
                if (payload.type === 'ANNOUNCE' && payload.user) {
                  this.connectToPeer(payload.peerId, payload.user);
                } else if (payload.type === 'QUERY_PEERS' && this.selfPeerId) {
                  this.publishDiscoveryAnnounce();
                }
              }
            }
          } catch (err) {
            // ignore non-json messages
          }
        };

        ws.onclose = () => {
          if (!this.isDestroyed) {
            setTimeout(connectPubSub, 5000);
          }
        };

        ws.onerror = () => {
          // fallback silent
        };
      } catch (err) {
        console.warn('Discovery PubSub error:', err);
      }
    };

    connectPubSub();
  }

  // Publish announcement to discovery channels
  public publishDiscoveryAnnounce() {
    if (!this.selfPeerId) return;

    const payload = {
      type: 'ANNOUNCE',
      peerId: this.selfPeerId,
      user: this.currentUser,
      timestamp: Date.now(),
    };

    // 1. BroadcastChannel (instant multi-tab)
    try {
      this.broadcastChannel?.postMessage(payload);
    } catch (e) {
      // ignore
    }

    // 2. ntfy.sh public pubsub (cross-device)
    try {
      fetch(`https://ntfy.sh/${DISCOVERY_TOPIC}`, {
        method: 'POST',
        headers: { 'Title': 'discovery' },
        body: JSON.stringify(payload),
      }).catch(() => {
        // ignore
      });
    } catch (e) {
      // ignore
    }
  }

  // 4. Proactive Probing of Known Personas and Cached Peers
  private probeKnownPeers() {
    // Probe standard personas (except ourselves)
    for (const personaId of KNOWN_PERSONA_IDS) {
      if (personaId !== this.selfPeerId && !this.dataConnections.has(personaId)) {
        this.connectToPeer(personaId);
      }
    }

    // Probe any cached peers from previous sessions
    try {
      const cached = localStorage.getItem('syncwave_cached_peers');
      if (cached) {
        const peers = JSON.parse(cached);
        if (Array.isArray(peers)) {
          for (const p of peers) {
            if (p.peerId && p.peerId !== this.selfPeerId && !this.dataConnections.has(p.peerId)) {
              this.connectToPeer(p.peerId, p.user);
            }
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // Connect to a peer via PeerJS DataConnection
  public connectToPeer(targetPeerId: string, knownUser?: User) {
    if (!this.peer || !this.selfPeerId || targetPeerId === this.selfPeerId) return;
    if (this.dataConnections.has(targetPeerId)) return;

    try {
      console.log(`[PeerJS] Initiating DataConnection to ${targetPeerId}`);
      const conn = this.peer.connect(targetPeerId, {
        reliable: true,
        metadata: {
          user: this.currentUser,
          fromPeerId: this.selfPeerId,
        },
      });

      this.setupDataConnection(conn, knownUser);
    } catch (err) {
      console.warn(`Failed to connect to peer ${targetPeerId}:`, err);
    }
  }

  // Setup PeerJS DataConnection lifecycle and packet handling
  private setupDataConnection(conn: DataConnection, initialUser?: User) {
    const peerId = conn.peer;

    conn.on('open', () => {
      console.log(`[PeerJS] DataConnection open with ${peerId}`);
      this.dataConnections.set(peerId, conn);

      // Send greeting with our profile
      conn.send({
        type: 'presence:hello',
        user: this.currentUser,
        peerId: this.selfPeerId,
        knownPeers: Array.from(this.connectedPeers.values()).map(p => ({ user: p.user, peerId: p.peerId })),
      });

      if (initialUser) {
        this.registerConnectedPeer(initialUser, peerId);
      }
    });

    conn.on('data', (data: any) => {
      this.handleIncomingDataPacket(conn, data);
    });

    conn.on('close', () => {
      console.log(`[PeerJS] DataConnection closed with ${peerId}`);
      this.handlePeerDisconnected(peerId);
    });

    conn.on('error', (err) => {
      console.warn(`[PeerJS] DataConnection error with ${peerId}:`, err);
    });
  }

  // Handle incoming data packets over WebRTC DataChannel
  private handleIncomingDataPacket(conn: DataConnection, packet: any) {
    if (!packet || typeof packet !== 'object') return;
    const fromPeerId = conn.peer;

    switch (packet.type) {
      case 'presence:hello': {
        const remoteUser: User = {
          ...packet.user,
          status: 'online',
          lastActive: Date.now(),
        };
        this.registerConnectedPeer(remoteUser, fromPeerId);

        // Gossip mesh discovery: if they know other peers we don't, connect to them!
        if (Array.isArray(packet.knownPeers)) {
          for (const p of packet.knownPeers) {
            if (p.peerId && p.peerId !== this.selfPeerId && !this.dataConnections.has(p.peerId)) {
              this.connectToPeer(p.peerId, p.user);
            }
          }
        }
        break;
      }

      case 'presence:update': {
        if (packet.user) {
          const updatedUser: User = {
            ...packet.user,
            status: 'online',
            lastActive: Date.now(),
          };
          this.registerConnectedPeer(updatedUser, fromPeerId);
        }
        break;
      }

      case 'presence:heartbeat': {
        const existing = this.connectedPeers.get(packet.userId);
        if (existing) {
          existing.lastSeen = Date.now();
        }
        break;
      }

      case 'chat:new_message': {
        if (packet.message) {
          this.callbacks.onNewMessage(packet.message);
        }
        break;
      }

      case 'chat:reaction_updated': {
        if (packet.messageId && packet.reactions) {
          this.callbacks.onReactionUpdated(packet.messageId, packet.reactions);
        }
        break;
      }

      case 'chat:typing': {
        this.callbacks.onTyping(packet.userId, packet.userName, packet.targetId, Boolean(packet.isTyping));
        break;
      }

      case 'room:created': {
        if (packet.room) {
          this.callbacks.onRoomCreated(packet.room);
        }
        break;
      }

      case 'call:incoming': {
        this.callbacks.onIncomingCall({
          callId: packet.callId,
          callType: packet.callType,
          caller: packet.caller,
          isGroup: packet.isGroup,
          targetId: packet.targetId,
        });
        break;
      }

      case 'call:accepted': {
        this.callbacks.onCallAccepted(packet.callId);
        break;
      }

      case 'call:rejected': {
        this.callbacks.onCallRejected(packet.callId);
        break;
      }

      case 'call:participant_joined': {
        this.callbacks.onCallParticipantJoined(packet.callId, packet.participant);
        break;
      }

      case 'call:participant_left': {
        this.callbacks.onCallParticipantLeft(packet.callId, packet.userId);
        break;
      }

      case 'call:participant_status': {
        this.callbacks.onCallParticipantStatus(packet.callId, packet.userId, {
          isMuted: packet.isMuted,
          isCameraOff: packet.isCameraOff,
          isScreenSharing: packet.isScreenSharing,
        });
        break;
      }

      case 'call:ended': {
        this.callbacks.onCallEnded(packet.callId);
        break;
      }
    }
  }

  // Register a connected peer into the peer state and notify UI
  private registerConnectedPeer(user: User, peerId: string) {
    const existing = this.connectedPeers.get(user.id);
    this.connectedPeers.set(user.id, {
      user: {
        ...user,
        status: 'online',
        lastActive: Date.now(),
      },
      peerId,
      lastSeen: Date.now(),
    });

    // Save to localStorage cache for future sessions
    try {
      const peersToCache = Array.from(this.connectedPeers.values()).map(p => ({
        user: p.user,
        peerId: p.peerId,
      }));
      localStorage.setItem('syncwave_cached_peers', JSON.stringify(peersToCache.slice(0, 15)));
    } catch (e) {
      // ignore
    }

    if (!existing) {
      console.log(`[PeerJS Mesh] New peer online: ${user.name} (${user.id})`);
      this.callbacks.onUserJoined(user);
    }

    this.notifyUsersSync();
  }

  private handlePeerDisconnected(peerId: string) {
    this.dataConnections.delete(peerId);
    this.mediaConnections.delete(peerId);

    // Find userId
    let foundUserId: string | null = null;
    for (const [userId, info] of this.connectedPeers.entries()) {
      if (info.peerId === peerId) {
        foundUserId = userId;
        break;
      }
    }

    if (foundUserId) {
      this.connectedPeers.delete(foundUserId);
      this.callbacks.onUserLeft(foundUserId);
      this.notifyUsersSync();
    }

    this.callbacks.onRemoteStreamRemoved(peerId);
  }

  private notifyUsersSync() {
    const users = Array.from(this.connectedPeers.values()).map((p) => p.user);
    this.callbacks.onUsersSync(users);
  }

  // Start periodic heartbeat and stale peer cleaner
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isDestroyed) return;

      // Broadcast heartbeat over data channels
      this.broadcastToDataChannels({
        type: 'presence:heartbeat',
        userId: this.currentUser.id,
      });

      // Also publish discovery announcement periodically (every 30s)
      this.publishDiscoveryAnnounce();

      // Clean up peers not heard from in 60 seconds
      const now = Date.now();
      let changed = false;
      for (const [userId, info] of this.connectedPeers.entries()) {
        if (now - info.lastSeen > 65000) {
          console.log(`[PeerJS Mesh] Peer timed out: ${info.user.name}`);
          this.connectedPeers.delete(userId);
          this.callbacks.onUserLeft(userId);
          changed = true;
        }
      }

      if (changed) {
        this.notifyUsersSync();
      }
    }, 15000);
  }

  // Broadcast data packet to all open DataConnections
  public broadcastToDataChannels(payload: any) {
    for (const [, conn] of this.dataConnections) {
      if (conn.open) {
        try {
          conn.send(payload);
        } catch (e) {
          console.warn('Failed to send on DataConnection:', e);
        }
      }
    }
  }

  // Send data packet to a specific user
  public sendToUser(userId: string, payload: any) {
    const peerInfo = this.connectedPeers.get(userId);
    if (peerInfo) {
      const conn = this.dataConnections.get(peerInfo.peerId);
      if (conn && conn.open) {
        conn.send(payload);
        return true;
      }
    }
    // Also try sending directly by peerId if userId matches peerId
    const directConn = this.dataConnections.get(userId);
    if (directConn && directConn.open) {
      directConn.send(payload);
      return true;
    }
    return false;
  }

  // ===================== MESSAGING & CHAT =====================

  public sendMessage(message: Message) {
    if (message.isGroup) {
      // Group room message: broadcast across mesh
      this.broadcastToDataChannels({
        type: 'chat:new_message',
        message,
      });
    } else {
      // 1-on-1 Direct Message: send directly to target user and broadcast so multi-tabs know
      this.sendToUser(message.targetId, {
        type: 'chat:new_message',
        message,
      });
      this.broadcastToDataChannels({
        type: 'chat:new_message',
        message,
      });
    }
  }

  public sendReaction(messageId: string, reactions: Record<string, string[]>) {
    this.broadcastToDataChannels({
      type: 'chat:reaction_updated',
      messageId,
      reactions,
    });
  }

  public sendTyping(targetId: string, isGroup: boolean, isTyping: boolean) {
    const payload = {
      type: 'chat:typing',
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      targetId,
      isTyping,
    };

    if (isGroup) {
      this.broadcastToDataChannels(payload);
    } else {
      this.sendToUser(targetId, payload);
    }
  }

  public createRoom(room: Room) {
    this.broadcastToDataChannels({
      type: 'room:created',
      room,
    });
  }

  // ===================== VOICE & VIDEO CALLS =====================

  public setLocalStream(stream: MediaStream) {
    this.localStream = stream;
    this.monitorSpeaking('local', stream);
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // Setup incoming PeerJS MediaConnection (call)
  private setupIncomingMediaConnection(mediaConn: MediaConnection) {
    const peerId = mediaConn.peer;
    this.mediaConnections.set(peerId, mediaConn);

    // Answer with localStream if available, or empty stream
    if (this.localStream) {
      mediaConn.answer(this.localStream);
    } else {
      // If user hasn't yet acquired mic, answer when stream is provided or empty
      const dummy = new MediaStream();
      mediaConn.answer(dummy);
    }

    mediaConn.on('stream', (remoteStream) => {
      console.log(`[PeerJS Call] Received remote stream from ${peerId}`);
      this.callbacks.onRemoteStream(peerId, remoteStream);
      this.monitorSpeaking(peerId, remoteStream);
    });

    mediaConn.on('close', () => {
      console.log(`[PeerJS Call] MediaConnection closed from ${peerId}`);
      this.callbacks.onRemoteStreamRemoved(peerId);
      this.mediaConnections.delete(peerId);
    });

    mediaConn.on('error', (err) => {
      console.warn(`[PeerJS Call] MediaConnection error:`, err);
    });
  }

  // Start outgoing call to peer or group room
  public startCall(callId: string, callType: 'audio' | 'video', targetId: string, isGroup: boolean, localStream: MediaStream) {
    this.setLocalStream(localStream);

    const callPayload = {
      type: 'call:incoming',
      callId,
      callType,
      caller: {
        id: this.currentUser.id,
        name: this.currentUser.name,
        avatar: this.currentUser.avatar,
      },
      isGroup,
      targetId,
    };

    if (isGroup) {
      // Broadcast call invitation to all connected peers
      this.broadcastToDataChannels(callPayload);

      // Call each peer directly
      for (const [, info] of this.connectedPeers) {
        this.initiateMediaCallTo(info.peerId, localStream);
      }
    } else {
      // 1-on-1: send call invitation to target peer
      this.sendToUser(targetId, callPayload);

      const targetInfo = this.connectedPeers.get(targetId);
      if (targetInfo) {
        this.initiateMediaCallTo(targetInfo.peerId, localStream);
      }
    }
  }

  // Initiate PeerJS Media Call to specific peer
  public initiateMediaCallTo(remotePeerId: string, stream: MediaStream) {
    if (!this.peer || remotePeerId === this.selfPeerId) return;

    try {
      console.log(`[PeerJS Call] Calling ${remotePeerId}...`);
      const mediaConn = this.peer.call(remotePeerId, stream);
      this.mediaConnections.set(remotePeerId, mediaConn);

      mediaConn.on('stream', (remoteStream) => {
        console.log(`[PeerJS Call] Outgoing call received remote stream from ${remotePeerId}`);
        this.callbacks.onRemoteStream(remotePeerId, remoteStream);
        this.monitorSpeaking(remotePeerId, remoteStream);
      });

      mediaConn.on('close', () => {
        this.callbacks.onRemoteStreamRemoved(remotePeerId);
        this.mediaConnections.delete(remotePeerId);
      });

      mediaConn.on('error', (err) => {
        console.warn(`[PeerJS Call] Error with ${remotePeerId}:`, err);
      });
    } catch (err) {
      console.warn(`Failed to initiate media call to ${remotePeerId}:`, err);
    }
  }

  // Accept incoming call and answer
  public acceptCall(callId: string, localStream: MediaStream, callerPeerId?: string) {
    this.setLocalStream(localStream);

    // Answer any pending media connections
    for (const [pId, mediaConn] of this.mediaConnections) {
      try {
        mediaConn.answer(localStream);
      } catch (e) {
        // already answered
      }
    }

    // Notify caller
    this.broadcastToDataChannels({
      type: 'call:accepted',
      callId,
      participant: {
        userId: this.currentUser.id,
        name: this.currentUser.name,
        avatar: this.currentUser.avatar,
        isMuted: false,
        isCameraOff: false,
        isScreenSharing: false,
        joinedAt: Date.now(),
      },
    });

    if (callerPeerId) {
      this.initiateMediaCallTo(callerPeerId, localStream);
    }
  }

  // Join group room call
  public joinGroupRoomCall(callId: string, roomId: string, localStream: MediaStream) {
    this.setLocalStream(localStream);

    // Broadcast join event
    this.broadcastToDataChannels({
      type: 'call:participant_joined',
      callId,
      participant: {
        userId: this.currentUser.id,
        name: this.currentUser.name,
        avatar: this.currentUser.avatar,
        isMuted: false,
        isCameraOff: false,
        isScreenSharing: false,
        joinedAt: Date.now(),
      },
    });

    // Call all currently connected peers
    for (const [, info] of this.connectedPeers) {
      this.initiateMediaCallTo(info.peerId, localStream);
    }
  }

  // Reject incoming call
  public rejectCall(callId: string, recipientId: string) {
    this.broadcastToDataChannels({
      type: 'call:rejected',
      callId,
      recipientId,
    });
  }

  // End active call
  public endCall(callId: string) {
    this.broadcastToDataChannels({
      type: 'call:ended',
      callId,
    });

    // Close all media connections
    for (const [, mediaConn] of this.mediaConnections) {
      try {
        mediaConn.close();
      } catch (e) {
        // ignore
      }
    }
    this.mediaConnections.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }
  }

  // Mute / Unmute audio
  public setAudioMuted(muted: boolean) {
    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        track.enabled = !muted;
      }
    }
  }

  // Video Camera on / off
  public setVideoDisabled(disabled: boolean) {
    if (this.localStream) {
      for (const track of this.localStream.getVideoTracks()) {
        track.enabled = !disabled;
      }
    }
  }

  // Screen share support
  public async startScreenShare(): Promise<MediaStream | null> {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        this.screenStream = stream;

        const screenTrack = stream.getVideoTracks()[0];
        if (screenTrack) {
          // Replace video track on all active media connections
          for (const mediaConn of this.mediaConnections.values()) {
            const pc = (mediaConn as any).peerConnection as RTCPeerConnection;
            if (pc) {
              const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
              if (sender) {
                sender.replaceTrack(screenTrack);
              }
            }
          }

          screenTrack.onended = () => {
            this.stopScreenShare();
          };
        }
        return stream;
      }
    } catch (err) {
      console.warn('Screen share cancelled or not available', err);
    }
    return null;
  }

  public stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }

    if (this.localStream) {
      const camTrack = this.localStream.getVideoTracks()[0] || null;
      for (const mediaConn of this.mediaConnections.values()) {
        const pc = (mediaConn as any).peerConnection as RTCPeerConnection;
        if (pc && camTrack) {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(camTrack);
          }
        }
      }
    }
  }

  // Audio level analyzer for active speaker indicator
  private monitorSpeaking(peerId: string, stream: MediaStream) {
    try {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;

      if (!this.localAudioCtx) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.localAudioCtx = new AudioContextClass();
      }

      if (this.localAudioCtx.state === 'suspended') {
        this.localAudioCtx.resume();
      }

      const source = this.localAudioCtx.createMediaStreamSource(stream);
      const analyser = this.localAudioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let wasSpeaking = false;

      const intervalId = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const isSpeaking = avg > 14;

        if (isSpeaking !== wasSpeaking) {
          wasSpeaking = isSpeaking;
          this.callbacks.onPeerSpeaking(peerId, isSpeaking);
        }
      }, 150);

      this.audioAnalyzers.set(peerId, { analyser, intervalId });
    } catch (e) {
      // AudioContext not allowed before user gesture
    }
  }

  public getSelfPeerId(): string {
    return this.selfPeerId;
  }

  public getConnectedUserList(): User[] {
    return Array.from(this.connectedPeers.values()).map(p => p.user);
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.discoveryWs) this.discoveryWs.close();
    if (this.broadcastChannel) this.broadcastChannel.close();

    for (const [, a] of this.audioAnalyzers) {
      clearInterval(a.intervalId);
    }
    this.audioAnalyzers.clear();

    for (const [, c] of this.dataConnections) {
      c.close();
    }
    this.dataConnections.clear();

    for (const [, m] of this.mediaConnections) {
      m.close();
    }
    this.mediaConnections.clear();

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}
