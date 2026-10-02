import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '25mb' }));

const server = createServer(app);
const wss = new WebSocketServer({ server });

interface UserLocation {
  city: string;
  country: string;
  flag: string;
  timezone: string;
  lat: number;
  lng: number;
}

interface User {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'away' | 'busy' | 'in-call';
  customStatus?: string;
  location?: UserLocation;
  lastActive: number;
}

interface Message {
  id: string;
  targetId: string; // roomId or userId (for DM)
  isGroup: boolean;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'file';
  voiceAudio?: string; // base64 data url for voice note
  voiceDuration?: number;
  reactions: Record<string, string[]>; // emoji -> array of userIds
  replyTo?: {
    id: string;
    senderName: string;
    text: string;
  };
  timestamp: number;
}

interface Room {
  id: string;
  name: string;
  description: string;
  type: 'text' | 'voice-video';
  createdById: string;
  createdAt: number;
  activeCall?: {
    callId: string;
    callType: 'audio' | 'video';
    startedAt: number;
    participants: string[]; // userIds
  };
}

interface ActiveCall {
  callId: string;
  type: 'audio' | 'video';
  isGroup: boolean;
  targetId: string; // roomId or recipientId
  initiatorId: string;
  initiatorName: string;
  initiatorAvatar: string;
  startedAt: number;
  participants: Map<string, {
    userId: string;
    name: string;
    avatar: string;
    isMuted: boolean;
    isCameraOff: boolean;
    isScreenSharing: boolean;
    joinedAt: number;
  }>;
}

// In-Memory Database
const clients = new Map<string, { ws: WebSocket; user: User }>();

const defaultRooms: Room[] = [
  {
    id: 'global-connect',
    name: 'Elie Chat Global Hub',
    description: 'Connecting people across all continents. Live chat, culture exchange, and cross-border syncs.',
    type: 'text',
    createdById: 'system',
    createdAt: Date.now() - 3600000 * 24,
  },
  {
    id: 'world-video-stage',
    name: 'World Video Stage 🌍',
    description: '24/7 Live multi-user video stage bridging Kigali, New York, Berlin, Tokyo & worldwide.',
    type: 'voice-video',
    createdById: 'system',
    createdAt: Date.now() - 3600000 * 24,
  },
  {
    id: 'kigali-africa',
    name: 'Kigali & Pan-Africa Hub',
    description: 'Rwanda, East Africa, and pan-African technology & culture connection.',
    type: 'text',
    createdById: 'system',
    createdAt: Date.now() - 3600000 * 20,
  },
  {
    id: 'global-voice-lounge',
    name: 'Global Voice Lounge 🎙️',
    description: 'Drop-in worldwide audio room. Hear voices from different continents in real time.',
    type: 'voice-video',
    createdById: 'system',
    createdAt: Date.now() - 3600000 * 18,
  }
];

const rooms = new Map<string, Room>(defaultRooms.map(r => [r.id, r]));

const messages: Message[] = [
  {
    id: 'm-init-1',
    targetId: 'global-connect',
    isGroup: true,
    senderId: 'user-elie',
    senderName: 'Elie Manirakiza',
    senderAvatar: '/src/assets/images/avatar_elie_1790670827487.jpg',
    text: 'Muraho and welcome to Elie Chat! 🌍 We built this platform to connect people living in different locations across the globe with instant real-time messaging, crisp voice calls, and multi-user video stages.',
    reactions: { '❤️': ['user-elie', 'system-elena'], '🌍': ['user-elie', 'system-marcus'] },
    timestamp: Date.now() - 3600000 * 3,
  },
  {
    id: 'm-init-2',
    targetId: 'global-connect',
    isGroup: true,
    senderId: 'system-elena',
    senderName: 'Elena Rostova',
    senderAvatar: '/src/assets/images/avatar_tech_lead_1790668646558.jpg',
    text: 'Greetings from Berlin, Germany! 🇩🇪 Even across 6,000+ kilometers, the peer-to-peer WebRTC connection is blazing fast with zero lag.',
    reactions: { '⚡': ['user-elie'] },
    timestamp: Date.now() - 3600000 * 2,
  },
  {
    id: 'm-init-3',
    targetId: 'global-connect',
    isGroup: true,
    senderId: 'system-marcus',
    senderName: 'Marcus Vance',
    senderAvatar: '/src/assets/images/avatar_designer_1790668663121.jpg',
    text: 'Good morning from New York, USA! 🇺🇸 Check out the World Map tab at the top to see live pins, local times, and start a call across the globe.',
    reactions: { '🚀': ['user-elie', 'system-elena'] },
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
    reactions: { '🎥': ['system-marcus'] },
    timestamp: Date.now() - 3600000 * 1,
  }
];

const activeCalls = new Map<string, ActiveCall>();

function broadcast(msg: object, filter?: (clientWs: WebSocket, user: User) => boolean) {
  const payload = JSON.stringify(msg);
  for (const [, client] of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      if (!filter || filter(client.ws, client.user)) {
        client.ws.send(payload);
      }
    }
  }
}

function sendToUser(userId: string, msg: object) {
  const client = clients.get(userId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(msg));
  }
}

function getSerializableActiveCalls() {
  const result: any[] = [];
  for (const call of activeCalls.values()) {
    result.push({
      callId: call.callId,
      type: call.type,
      isGroup: call.isGroup,
      targetId: call.targetId,
      initiatorId: call.initiatorId,
      initiatorName: call.initiatorName,
      initiatorAvatar: call.initiatorAvatar,
      startedAt: call.startedAt,
      participants: Array.from(call.participants.values()),
    });
  }
  return result;
}

wss.on('connection', (ws: WebSocket) => {
  let currentUserId: string | null = null;

  ws.on('message', (dataStr: string) => {
    try {
      const data = JSON.parse(dataStr);

      switch (data.type) {
        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;
        }

        case 'identify': {
          const userId = data.user?.id;
          if (!userId) return;
          currentUserId = userId;
          const user: User = {
            id: userId,
            name: data.user.name || 'Anonymous User',
            avatar: data.user.avatar || '',
            status: data.user.status || 'online',
            customStatus: data.user.customStatus,
            location: data.user.location,
            lastActive: Date.now(),
          };

          clients.set(userId, { ws, user });

          // Send back initial snapshot to this client
          const userList = Array.from(clients.values()).map(c => c.user);
          ws.send(
            JSON.stringify({
              type: 'init_sync',
              users: userList,
              rooms: Array.from(rooms.values()),
              messages: messages.slice(-150),
              activeCalls: getSerializableActiveCalls(),
            })
          );

          // Broadcast user_joined / presence_update to everyone else
          broadcast(
            {
              type: 'presence:update',
              user,
            },
            clientWs => clientWs !== ws
          );
          break;
        }

        case 'user:update_profile': {
          if (!currentUserId || !clients.has(currentUserId)) return;
          const client = clients.get(currentUserId)!;
          client.user = {
            ...client.user,
            name: data.name ?? client.user.name,
            avatar: data.avatar ?? client.user.avatar,
            status: data.status ?? client.user.status,
            customStatus: data.customStatus ?? client.user.customStatus,
            location: data.location ?? client.user.location,
            lastActive: Date.now(),
          };
          broadcast({
            type: 'presence:update',
            user: client.user,
          });
          break;
        }

        case 'chat:send': {
          const message: Message = {
            id: data.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            targetId: data.targetId,
            isGroup: Boolean(data.isGroup),
            senderId: data.senderId,
            senderName: data.senderName,
            senderAvatar: data.senderAvatar,
            text: data.text || '',
            mediaUrl: data.mediaUrl,
            mediaType: data.mediaType,
            voiceAudio: data.voiceAudio,
            voiceDuration: data.voiceDuration,
            reactions: {},
            replyTo: data.replyTo,
            timestamp: Date.now(),
          };

          messages.push(message);
          if (messages.length > 500) messages.shift(); // keep last 500 messages

          // If it's a group, broadcast to all
          // If it's a DM, send to sender and receiver
          if (message.isGroup) {
            broadcast({
              type: 'chat:new_message',
              message,
            });
          } else {
            // TargetId is the recipient user ID
            sendToUser(message.targetId, {
              type: 'chat:new_message',
              message,
            });
            // also echo back to sender if not already sent
            sendToUser(message.senderId, {
              type: 'chat:new_message',
              message,
            });
          }
          break;
        }

        case 'chat:reaction': {
          const { messageId, emoji, userId } = data;
          const targetMsg = messages.find(m => m.id === messageId);
          if (targetMsg) {
            if (!targetMsg.reactions[emoji]) {
              targetMsg.reactions[emoji] = [];
            }
            const idx = targetMsg.reactions[emoji].indexOf(userId);
            if (idx > -1) {
              targetMsg.reactions[emoji].splice(idx, 1);
              if (targetMsg.reactions[emoji].length === 0) {
                delete targetMsg.reactions[emoji];
              }
            } else {
              targetMsg.reactions[emoji].push(userId);
            }

            broadcast({
              type: 'chat:reaction_updated',
              messageId,
              targetId: targetMsg.targetId,
              reactions: targetMsg.reactions,
            });
          }
          break;
        }

        case 'chat:typing': {
          const { targetId, isGroup, isTyping, userId, userName } = data;
          if (isGroup) {
            broadcast(
              {
                type: 'chat:user_typing',
                targetId,
                isGroup,
                isTyping,
                userId,
                userName,
              },
              clientWs => clientWs !== ws
            );
          } else {
            sendToUser(targetId, {
              type: 'chat:user_typing',
              targetId: userId, // from recipient's perspective, who is typing
              isGroup,
              isTyping,
              userId,
              userName,
            });
          }
          break;
        }

        case 'room:create': {
          const newRoom: Room = {
            id: (data.name || 'room').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Math.random().toString(36).substring(2, 6),
            name: data.name,
            description: data.description || '',
            type: data.isVoiceVideo ? 'voice-video' : 'text',
            createdById: data.userId,
            createdAt: Date.now(),
          };
          rooms.set(newRoom.id, newRoom);
          broadcast({
            type: 'room:created',
            room: newRoom,
          });
          break;
        }

        // ================= WEBRTC & CALL SIGNALING =================
        case 'call:initiate': {
          const { callId, callType, isGroup, targetId, initiator } = data;

          let existing = activeCalls.get(callId);
          if (!existing) {
            existing = {
              callId,
              type: callType,
              isGroup: Boolean(isGroup),
              targetId,
              initiatorId: initiator.id,
              initiatorName: initiator.name,
              initiatorAvatar: initiator.avatar,
              startedAt: Date.now(),
              participants: new Map(),
            };
            activeCalls.set(callId, existing);
          }

          existing.participants.set(initiator.id, {
            userId: initiator.id,
            name: initiator.name,
            avatar: initiator.avatar,
            isMuted: false,
            isCameraOff: callType === 'audio',
            isScreenSharing: false,
            joinedAt: Date.now(),
          });

          // If group call in a room, mark room active call
          if (isGroup) {
            const room = rooms.get(targetId);
            if (room) {
              room.activeCall = {
                callId,
                callType,
                startedAt: Date.now(),
                participants: Array.from(existing.participants.keys()),
              };
            }
          }

          // Broadcast active calls update
          broadcast({
            type: 'calls:updated',
            activeCalls: getSerializableActiveCalls(),
          });

          if (!isGroup) {
            // Send incoming call prompt directly to the recipient
            sendToUser(targetId, {
              type: 'call:incoming',
              callId,
              callType,
              isGroup: false,
              caller: initiator,
            });
          } else {
            // For group call, notify room participants
            broadcast(
              {
                type: 'call:room_call_started',
                callId,
                callType,
                roomId: targetId,
                initiator,
              },
              clientWs => clientWs !== ws
            );
          }
          break;
        }

        case 'call:join': {
          const { callId, user } = data;
          const call = activeCalls.get(callId);
          if (call) {
            call.participants.set(user.id, {
              userId: user.id,
              name: user.name,
              avatar: user.avatar,
              isMuted: false,
              isCameraOff: call.type === 'audio',
              isScreenSharing: false,
              joinedAt: Date.now(),
            });

            // Update room active call if group
            if (call.isGroup) {
              const room = rooms.get(call.targetId);
              if (room && room.activeCall) {
                room.activeCall.participants = Array.from(call.participants.keys());
              }
            }

            // Notify everyone in the call about new participant
            for (const participantId of call.participants.keys()) {
              sendToUser(participantId, {
                type: 'call:participant_joined',
                callId,
                participant: call.participants.get(user.id),
                allParticipants: Array.from(call.participants.values()),
              });
            }

            broadcast({
              type: 'calls:updated',
              activeCalls: getSerializableActiveCalls(),
            });
          }
          break;
        }

        case 'call:decline': {
          const { callId, recipientId, reason } = data;
          const call = activeCalls.get(callId);
          if (call) {
            sendToUser(call.initiatorId, {
              type: 'call:rejected',
              callId,
              recipientId,
              reason: reason || 'declined',
            });
            activeCalls.delete(callId);
            broadcast({
              type: 'calls:updated',
              activeCalls: getSerializableActiveCalls(),
            });
          }
          break;
        }

        case 'call:leave': {
          const { callId, userId } = data;
          const call = activeCalls.get(callId);
          if (call) {
            call.participants.delete(userId);

            // Notify remaining participants
            for (const participantId of call.participants.keys()) {
              sendToUser(participantId, {
                type: 'call:participant_left',
                callId,
                userId,
                remainingParticipants: Array.from(call.participants.values()),
              });
            }

            if (call.participants.size === 0 || (!call.isGroup && call.participants.size <= 1)) {
              // Call ended
              if (call.isGroup) {
                const room = rooms.get(call.targetId);
                if (room) {
                  delete room.activeCall;
                }
              }
              activeCalls.delete(callId);
              broadcast({
                type: 'call:ended',
                callId,
              });
            }

            broadcast({
              type: 'calls:updated',
              activeCalls: getSerializableActiveCalls(),
            });
          }
          break;
        }

        case 'call:participant_status': {
          const { callId, userId, isMuted, isCameraOff, isScreenSharing } = data;
          const call = activeCalls.get(callId);
          if (call) {
            const p = call.participants.get(userId);
            if (p) {
              if (isMuted !== undefined) p.isMuted = isMuted;
              if (isCameraOff !== undefined) p.isCameraOff = isCameraOff;
              if (isScreenSharing !== undefined) p.isScreenSharing = isScreenSharing;

              for (const pid of call.participants.keys()) {
                sendToUser(pid, {
                  type: 'call:participant_status_updated',
                  callId,
                  userId,
                  status: {
                    isMuted: p.isMuted,
                    isCameraOff: p.isCameraOff,
                    isScreenSharing: p.isScreenSharing,
                  },
                });
              }
            }
          }
          break;
        }

        case 'call:signal': {
          // WebRTC SDP offer, answer, or ICE candidate forwarded directly to toPeerId
          const { toPeerId, fromPeerId, callId, signal } = data;
          sendToUser(toPeerId, {
            type: 'call:signal',
            callId,
            fromPeerId,
            signal,
          });
          break;
        }
      }
    } catch (err) {
      console.error('Error handling WS message:', err);
    }
  });

  ws.on('close', () => {
    if (currentUserId && clients.has(currentUserId)) {
      const user = clients.get(currentUserId)!.user;
      clients.delete(currentUserId);

      // Remove from any active calls
      for (const [callId, call] of activeCalls.entries()) {
        if (call.participants.has(currentUserId)) {
          call.participants.delete(currentUserId);
          for (const pid of call.participants.keys()) {
            sendToUser(pid, {
              type: 'call:participant_left',
              callId,
              userId: currentUserId,
              remainingParticipants: Array.from(call.participants.values()),
            });
          }
          if (call.participants.size === 0 || (!call.isGroup && call.participants.size <= 1)) {
            activeCalls.delete(callId);
            if (call.isGroup) {
              const r = rooms.get(call.targetId);
              if (r) delete r.activeCall;
            }
          }
        }
      }

      broadcast({
        type: 'presence:user_left',
        userId: currentUserId,
        user,
      });

      broadcast({
        type: 'calls:updated',
        activeCalls: getSerializableActiveCalls(),
      });
    }
  });
});

// REST Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    connections: clients.size,
    activeCalls: activeCalls.size,
    rooms: rooms.size,
  });
});

// Vite Middleware for Dev or Static files for Prod
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`SyncWave Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
