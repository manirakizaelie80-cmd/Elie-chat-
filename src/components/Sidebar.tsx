import React, { useState } from 'react';
import { 
  Hash, 
  Video, 
  Plus, 
  Phone, 
  Search, 
  Users, 
  Trash2, 
  X, 
  Headphones, 
  Check, 
  Clock,
  Lock,
  Globe,
  Settings,
  UserCheck,
  UserPlus,
  Shield,
  ChevronRight,
  MessageSquare,
  MessageCircle,
  ExternalLink,
  Camera
} from 'lucide-react';
import { Room, User, ActiveCall, GroupInvitation, ContactRequest, Message } from '../types';
import { formatLastSeen } from '../utils/userSync';
import { DEFAULT_AVATAR } from '../utils/photoUpload';

export interface RecentChattedContact {
  user: User;
  lastMessage?: Message;
  unreadCount: number;
}

interface SidebarProps {
  currentUser: User;
  rooms: Room[];
  activeRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  users: User[];
  currentUserId: string;
  activeDirectUserId: string | null;
  onSelectDirectUser: (userId: string) => void;
  activeCalls: ActiveCall[];
  onStart1on1Call: (targetUser: User, type: 'audio' | 'video') => void;
  onJoinRoomCall: (room: Room) => void;
  onCreateChannelClick: () => void;
  onDeleteRoom?: (roomId: string) => void;
  unreadCounts?: Record<string, number>;
  onlineCount?: number;
  // Mobile separation support
  isMobileChatActive?: boolean;
  onCloseMobile?: () => void;
  // Group invitations and management
  pendingInvitations?: GroupInvitation[];
  onRespondInvitation?: (inv: GroupInvitation, accept: boolean) => void;
  onOpenGroupManagement?: (group: Room, initialTab?: 'details' | 'invite' | 'requests' | 'invitations') => void;
  onRequestJoinGroup?: (group: Room) => void;
  // Privacy & Contact Request System
  incomingContactRequests?: ContactRequest[];
  onAcceptContactRequest?: (request: ContactRequest) => void;
  onRejectContactRequest?: (requestId: string) => void;
  onOpenAddContact?: () => void;
  // Recent Chatted Contacts & All Contacts Directory
  recentChattedContacts?: RecentChattedContact[];
  onOpenAllContacts?: () => void;
  onOpenProfile?: () => void;
}

function formatRecentTime(timestamp?: number): string {
  if (!timestamp) return '';
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  if (diff < 172800000) return '1d';
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
}

function formatMessageSnippet(msg?: Message): string {
  if (!msg) return 'No messages yet';
  if (msg.voiceAudio) return '🎙️ Voice note';
  if (msg.mediaType === 'image') return '📷 Photo';
  if (msg.mediaType === 'video') return '🎥 Video';
  if (msg.mediaType === 'file') return `📎 ${msg.fileName || 'Attachment'}`;
  return msg.text || 'Message';
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  rooms,
  activeRoomId,
  onSelectRoom,
  users,
  currentUserId,
  activeDirectUserId,
  onSelectDirectUser,
  activeCalls,
  onStart1on1Call,
  onJoinRoomCall,
  onCreateChannelClick,
  onDeleteRoom,
  unreadCounts = {},
  onlineCount,
  isMobileChatActive = false,
  onCloseMobile,
  pendingInvitations = [],
  onRespondInvitation,
  onOpenGroupManagement,
  onRequestJoinGroup,
  incomingContactRequests = [],
  onAcceptContactRequest,
  onRejectContactRequest,
  onOpenAddContact,
  recentChattedContacts = [],
  onOpenAllContacts,
  onOpenProfile,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [groupFilter, setGroupFilter] = useState<'all' | 'created' | 'joined' | 'invited'>('all');

  // Filter out current user from direct users
  const otherUsers = users.filter((u) => u.id !== currentUserId);

  // Groups created by the current user
  const myCreatedRooms = rooms.filter((r) => r.createdById === currentUserId);

  // Groups joined by the current user (active member)
  const myJoinedRooms = rooms.filter(
    (r) => r.createdById !== currentUserId && (Array.isArray(r.memberIds) && r.memberIds.includes(currentUserId))
  );

  // Groups to which current user has an active invitation
  const myInvitedRooms = rooms.filter((r) =>
    pendingInvitations.some((inv) => inv.groupId === r.id)
  );

  // Active groups for the current user (created + joined + invited)
  const myActiveRooms = rooms.filter(
    (r) =>
      r.createdById === currentUserId ||
      (Array.isArray(r.memberIds) && r.memberIds.includes(currentUserId)) ||
      pendingInvitations.some((inv) => inv.groupId === r.id)
  );

  const filteredRooms = rooms.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!matchesSearch) return false;

    if (groupFilter === 'created') return r.createdById === currentUserId;
    if (groupFilter === 'joined') {
      return (
        r.createdById !== currentUserId &&
        Array.isArray(r.memberIds) &&
        r.memberIds.includes(currentUserId)
      );
    }
    if (groupFilter === 'invited') {
      return pendingInvitations.some((inv) => inv.groupId === r.id);
    }
    return true;
  });

  const filteredUsers = otherUsers.filter((u) =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.username && u.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (u.customStatus && u.customStatus.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (u.location?.city && u.location.city.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const onlinePeersCount = otherUsers.filter(
    (u) => u.status === 'online' || u.status === 'in-call' || u.status === 'busy'
  ).length;

  const handleRoomClick = (room: Room) => {
    onSelectRoom(room.id);
    if (onCloseMobile) onCloseMobile();
  };

  const handleDirectUserClick = (userId: string) => {
    onSelectDirectUser(userId);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <aside 
      className={`
        w-full md:w-72 lg:w-80 bg-slate-900 border-r border-slate-800 
        flex flex-col h-full shrink-0 select-none overflow-hidden
        ${isMobileChatActive ? 'hidden md:flex' : 'flex'}
      `}
    >
      {/* Header with Search and Mobile Close */}
      <div className="p-3 border-b border-slate-800 flex items-center gap-2 bg-slate-950/40">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search channels, groups & peers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* User Account Overview Card: Known Contacts Counter & View All My Contacts Option */}
      <div className="p-3 border-b border-slate-800/80 bg-slate-950/70 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div 
            onClick={onOpenProfile} 
            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group"
            title="Account profile & settings"
          >
            <div className="relative shrink-0 group/avatar">
              <img
                src={currentUser?.avatar || DEFAULT_AVATAR}
                alt={currentUser?.name || 'User'}
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-full object-cover border border-slate-700 group-hover:border-blue-500 transition-colors"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = DEFAULT_AVATAR;
                }}
              />
              <div 
                className="absolute inset-0 bg-slate-950/60 rounded-full flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity backdrop-blur-[1px]"
                title="Upload or change account image"
              >
                <Camera className="w-3.5 h-3.5 text-white drop-shadow" />
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                  currentUser?.status === 'online'
                    ? 'bg-emerald-500'
                    : currentUser?.status === 'away'
                    ? 'bg-amber-500'
                    : currentUser?.status === 'busy'
                    ? 'bg-red-500'
                    : 'bg-slate-600'
                }`}
              />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-xs font-bold text-slate-100 truncate group-hover:text-blue-400 transition-colors">
                {currentUser?.name}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {currentUser?.username ? `@${currentUser.username}` : 'Private Account'}
              </p>
            </div>
          </div>

          {onOpenProfile && (
            <button
              onClick={onOpenProfile}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
              title="Account Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Known Contacts Counter & View All Option Button */}
        <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[11px] font-semibold text-slate-200">
                {otherUsers.length} Known Contact{otherUsers.length === 1 ? '' : 's'}
              </span>
            </div>

            {onOpenAllContacts && (
              <button
                onClick={onOpenAllContacts}
                className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-0.5 transition-colors px-2 py-0.5 rounded-md hover:bg-blue-600/15"
                title="Open full contacts and groups directory"
              >
                <span>View all</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Groups visible under user's account */}
          <div className="flex items-center justify-between text-[10px] text-slate-400 bg-slate-900/80 rounded-lg px-2 py-1 border border-slate-800/60">
            <span className="flex items-center gap-1.5 truncate">
              <span className="text-purple-400 font-semibold">{myCreatedRooms.length} Created</span>
              <span className="text-slate-600">·</span>
              <span className="text-blue-400 font-semibold">{myJoinedRooms.length} Joined</span>
            </span>
            {myInvitedRooms.length > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-purple-600/20 text-purple-300 font-bold border border-purple-500/40 animate-pulse">
                {myInvitedRooms.length} Invited
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Pending Group Invitations Banner */}
      {pendingInvitations.length > 0 && onRespondInvitation && (
        <div className="p-2.5 bg-purple-950/40 border-b border-purple-800/40 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-purple-300">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              Pending Group Invitations ({pendingInvitations.length})
            </span>
          </div>
          <div className="space-y-1.5">
            {pendingInvitations.map((inv) => (
              <div 
                key={inv.id} 
                className="p-2 bg-slate-900/90 border border-purple-500/30 rounded-xl flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-100 truncate flex items-center gap-1">
                    <span>{inv.groupIcon || '👥'}</span>
                    <span className="truncate">{inv.groupName}</span>
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">From {inv.inviterName}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onRespondInvitation(inv, true)}
                    className="p-1 px-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-colors"
                    title="Approve and join group"
                  >
                    <Check className="w-2.5 h-2.5" /> Approve
                  </button>
                  <button
                    onClick={() => onRespondInvitation(inv, false)}
                    className="p-1 px-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg text-[10px] transition-colors"
                    title="Decline"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Ongoing Calls Banner */}
      {activeCalls.length > 0 && (
        <div className="p-3 border-b border-slate-800/80 bg-emerald-950/20">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-400 mb-2">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Live Calls In Progress
            </span>
          </div>
          <div className="space-y-1.5">
            {activeCalls.map((call) => {
              const isGroup = call.isGroup;
              const title = isGroup 
                ? (rooms.find(r => r.id === call.targetId)?.name || 'Group Stage')
                : `1-on-1: ${call.initiatorName}`;

              return (
                <div
                  key={call.callId}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-800/60 border border-emerald-900/50 text-xs"
                >
                  <div className="truncate mr-2">
                    <p className="font-medium text-slate-200 truncate">{title}</p>
                    <p className="text-[11px] text-slate-400">
                      {call.participants.length} in call · {call.type === 'video' ? 'Video' : 'Voice'}
                    </p>
                  </div>
                  {isGroup && (
                    <button
                      onClick={() => {
                        const room = rooms.find(r => r.id === call.targetId);
                        if (room) {
                          onJoinRoomCall(room);
                          if (onCloseMobile) onCloseMobile();
                        }
                      }}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors"
                    >
                      Join
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scrollable Navigation List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-6">
        {/* Section 1: Channels & Groups */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">
              Channels & Groups
            </span>
            <button
              onClick={onCreateChannelClick}
              title="Create channel or custom group"
              className="flex items-center gap-1 px-2 py-0.5 hover:bg-slate-800 rounded-md text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="text-[11px]">New</span>
            </button>
          </div>

          {/* Group Filter Tabs (All / Created / Joined / Invited) */}
          <div className="flex items-center gap-1 px-1 mb-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setGroupFilter('all')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors shrink-0 ${
                groupFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              All ({rooms.length})
            </button>
            <button
              onClick={() => setGroupFilter('created')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors shrink-0 flex items-center gap-1 ${
                groupFilter === 'created'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800/80 text-slate-400 hover:text-purple-300 hover:bg-slate-800'
              }`}
            >
              <span>Created</span>
              <span className="opacity-80">({myCreatedRooms.length})</span>
            </button>
            <button
              onClick={() => setGroupFilter('joined')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors shrink-0 flex items-center gap-1 ${
                groupFilter === 'joined'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800/80 text-slate-400 hover:text-emerald-300 hover:bg-slate-800'
              }`}
            >
              <span>Joined</span>
              <span className="opacity-80">({myJoinedRooms.length})</span>
            </button>
            {myInvitedRooms.length > 0 && (
              <button
                onClick={() => setGroupFilter('invited')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors shrink-0 flex items-center gap-1 ${
                  groupFilter === 'invited'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-800/80 text-amber-400 hover:text-amber-200 hover:bg-slate-800 animate-pulse'
                }`}
              >
                <span>Invited</span>
                <span className="opacity-90">({myInvitedRooms.length})</span>
              </button>
            )}
          </div>

          <div className="space-y-0.5">
            {filteredRooms.length === 0 ? (
              <div className="px-2.5 py-3 text-center text-xs text-slate-500">
                No rooms match filter
              </div>
            ) : (
              filteredRooms.map((room) => {
                const isSelected = activeRoomId === room.id && activeDirectUserId === null;
                const hasCall = Boolean(room.activeCall);
                const isCreator = room.createdById === currentUserId;
                const isMember = !room.isPrivate || (Array.isArray(room.memberIds) && room.memberIds.includes(currentUserId)) || isCreator;
                const isInvited = pendingInvitations.some((inv) => inv.groupId === room.id);
                const unread = unreadCounts[`room__${room.id}`] || 0;

                return (
                  <div
                    key={room.id}
                    onClick={() => handleRoomClick(room)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors group ${
                      isSelected
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                      {room.icon ? (
                        <span className="text-xs shrink-0">{room.icon}</span>
                      ) : room.isCustomGroup ? (
                        <Users className="w-3.5 h-3.5 shrink-0 text-purple-400" />
                      ) : room.type === 'voice-video' ? (
                        <Video className={`w-3.5 h-3.5 shrink-0 ${hasCall ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
                      ) : (
                        <Hash className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      )}
                      
                      <div className="truncate">
                        <span className="truncate block font-semibold">{room.name}</span>
                        {room.description && (
                          <span className="text-[10px] text-slate-500 truncate block">
                            {room.description}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
                      {/* Unread badge */}
                      {unread > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                          {unread}
                        </span>
                      )}

                      {/* Creator badge */}
                      {isCreator && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/25 text-purple-300 font-bold border border-purple-500/40">
                          Owner
                        </span>
                      )}

                      {/* Invited badge */}
                      {isInvited && !isMember && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/25 text-amber-300 font-bold border border-amber-500/40 animate-pulse">
                          Invited
                        </span>
                      )}

                      {/* Joined member badge */}
                      {!isCreator && isMember && room.isCustomGroup && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                          Joined
                        </span>
                      )}

                      {/* Privacy indicator for non-members */}
                      {room.isPrivate && !isMember && !isInvited && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 border border-amber-500/30 flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> Request
                        </span>
                      )}

                      {hasCall && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                          LIVE
                        </span>
                      )}

                      {/* Group Management Gear */}
                      {room.isCustomGroup && onOpenGroupManagement && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenGroupManagement(room);
                          }}
                          title="Manage group"
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-opacity"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {isCreator && onDeleteRoom && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete "${room.name}"?`)) {
                              onDeleteRoom(room.id);
                            }
                          }}
                          title="Delete room"
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-slate-500 hover:text-red-400 transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Section: Recent Chatted Contacts */}
        <div className="pb-1 border-b border-slate-800/80 mb-2">
          <div className="px-2 mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-blue-400" />
              <span>Recent Chats ({recentChattedContacts.length})</span>
            </span>
            {recentChattedContacts.length > 0 && onOpenAllContacts && (
              <button
                onClick={onOpenAllContacts}
                className="text-[10px] text-blue-400 hover:text-blue-300 font-medium"
              >
                All Contacts
              </button>
            )}
          </div>

          <div className="space-y-0.5">
            {recentChattedContacts.length === 0 ? (
              <div className="px-3 py-2 text-center text-[11px] text-slate-500 bg-slate-950/20 rounded-lg mx-1 border border-dashed border-slate-800">
                No recent direct chats yet
              </div>
            ) : (
              recentChattedContacts.map(({ user, lastMessage, unreadCount }) => {
                const isSelected = activeDirectUserId === user.id;
                const isOnline = user.status === 'online' || user.status === 'in-call';

                return (
                  <div
                    key={`recent-${user.id}`}
                    onClick={() => handleDirectUserClick(user.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors group ${
                      isSelected
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate flex-1 min-w-0 mr-1.5">
                      <div className="relative shrink-0">
                        <img
                          src={user.avatar || DEFAULT_AVATAR}
                          alt={user.name}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-full object-cover"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = DEFAULT_AVATAR;
                          }}
                        />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                            isOnline
                              ? 'bg-emerald-500'
                              : user.status === 'away'
                              ? 'bg-amber-500'
                              : 'bg-slate-600'
                          }`}
                        />
                      </div>

                      <div className="truncate text-left flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate block font-semibold text-slate-200">
                            {user.name}
                          </span>
                          {lastMessage?.timestamp && (
                            <span className="text-[10px] text-slate-400 shrink-0 font-normal">
                              {formatRecentTime(lastMessage.timestamp)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] text-slate-400 truncate block">
                            {formatMessageSnippet(lastMessage)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-bold shrink-0 ml-1">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Groups in Contacts: Visible for Creator, Joined Members & Invited Peers */}
        {myActiveRooms.length > 0 && (
          <div className="pb-2 border-b border-slate-800/80 mb-2">
            <div className="px-2 mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-purple-400" />
                <span>My Groups in Contacts ({myActiveRooms.length})</span>
              </span>
              {onOpenAllContacts && (
                <button
                  onClick={onOpenAllContacts}
                  className="text-[10px] text-purple-400 hover:text-purple-300 font-medium"
                >
                  Directory
                </button>
              )}
            </div>

            <div className="space-y-0.5">
              {myActiveRooms.map((room) => {
                const isSelected = activeRoomId === room.id && activeDirectUserId === null;
                const isCreator = room.createdById === currentUserId;
                const isMember = Array.isArray(room.memberIds) && room.memberIds.includes(currentUserId);
                const invitation = pendingInvitations.find((inv) => inv.groupId === room.id);
                const isInvited = Boolean(invitation);
                const unread = unreadCounts[`room__${room.id}`] || 0;

                return (
                  <div
                    key={`contact-group-${room.id}`}
                    onClick={() => handleRoomClick(room)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors group ${
                      isSelected
                        ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate flex-1 min-w-0 mr-1.5">
                      <div className="w-8 h-8 rounded-full bg-purple-950/80 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0 text-sm">
                        {room.icon ? (
                          <span>{room.icon}</span>
                        ) : room.type === 'voice-video' ? (
                          <Video className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Hash className="w-4 h-4 text-purple-400" />
                        )}
                      </div>

                      <div className="truncate text-left flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="truncate block font-semibold text-slate-200">
                            {room.name}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                          {isCreator && (
                            <span className="text-purple-400 font-semibold flex items-center gap-0.5">
                              👑 Owner
                            </span>
                          )}
                          {!isCreator && isMember && (
                            <span className="text-emerald-400 font-medium">
                              👥 Member ({room.memberIds?.length || 1})
                            </span>
                          )}
                          {isInvited && !isMember && (
                            <span className="text-amber-400 font-semibold animate-pulse">
                              📨 Invited · Full chat access
                            </span>
                          )}
                          {room.description && (
                            <>
                              <span className="text-slate-600">·</span>
                              <span className="truncate text-slate-500">{room.description}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {unread > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                          {unread}
                        </span>
                      )}
                      {isInvited && !isMember && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                          Join
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 2: Contacts & Private Chats (Private, Authorized-Only Directory) */}
        <div>
          <div className="px-2 mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">
                Contacts ({otherUsers.length})
              </span>
              {onlinePeersCount > 0 && (
                <span className="text-[10px] text-emerald-400 font-semibold">
                  · {onlinePeersCount} online
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {onOpenAllContacts && (
                <button
                  onClick={onOpenAllContacts}
                  className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-semibold flex items-center gap-1 transition-colors"
                  title="View all my contacts"
                >
                  <Users className="w-3 h-3 text-blue-400" />
                  <span>View All</span>
                </button>
              )}
              {onOpenAddContact && (
                <button
                  onClick={onOpenAddContact}
                  className="px-2 py-0.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 border border-blue-500/30 text-[10px] font-semibold flex items-center gap-1 transition-colors"
                  title="Search known user by exact username"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>Add</span>
                </button>
              )}
            </div>
          </div>

          {/* Pending Contact Requests Received */}
          {incomingContactRequests.length > 0 && onAcceptContactRequest && onRejectContactRequest && (
            <div className="mb-2 p-2 bg-amber-950/30 border border-amber-500/30 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-amber-300">
                <span className="flex items-center gap-1">
                  <UserPlus className="w-3 h-3 text-amber-400" />
                  Contact Requests ({incomingContactRequests.length})
                </span>
              </div>
              <div className="space-y-1.5">
                {incomingContactRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-2 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {req.senderAvatar ? (
                        <img
                          src={req.senderAvatar}
                          alt={req.senderName}
                          className="w-7 h-7 rounded-full object-cover shrink-0"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = DEFAULT_AVATAR;
                          }}
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center text-[10px] font-semibold shrink-0">
                          {req.senderName[0] || 'U'}
                        </div>
                      )}
                      <div className="min-w-0 text-left">
                        <p className="text-xs font-semibold text-slate-200 truncate">{req.senderName}</p>
                        <p className="text-[10px] text-slate-400 truncate">@{req.senderUsername}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => onAcceptContactRequest(req)}
                        className="p-1 px-2.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-semibold flex items-center gap-1 transition-colors"
                        title="Approve contact connection"
                      >
                        <Check className="w-2.5 h-2.5" /> Approve
                      </button>
                      <button
                        onClick={() => onRejectContactRequest(req.id)}
                        className="p-1 px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-[10px] transition-colors"
                        title="Decline"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-0.5">
            {filteredUsers.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800/60 my-1">
                {otherUsers.length === 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-slate-300 font-medium">No contacts yet</p>
                    <p className="text-[11px] text-slate-500">
                      Your Elie Chat is private. Find and connect with people you know using their unique @username.
                    </p>
                    {onOpenAddContact && (
                      <button
                        onClick={onOpenAddContact}
                        className="mt-1 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Find by @Username</span>
                      </button>
                    )}
                  </div>
                ) : (
                  'No contacts match search.'
                )}
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isSelected = activeDirectUserId === user.id;
                const convId = [currentUserId, user.id].sort().join('__');
                const unread = unreadCounts[convId] || 0;
                const isOnline = user.status === 'online' || user.status === 'in-call';

                return (
                  <div
                    key={user.id}
                    onClick={() => handleDirectUserClick(user.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors group ${
                      isSelected
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate flex-1 min-w-0 mr-1.5">
                      <div className="relative shrink-0">
                        {user.avatar ? (
                          <img
                            src={user.avatar}
                            alt={user.name}
                            referrerPolicy="no-referrer"
                            className="w-8 h-8 rounded-full object-cover"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = DEFAULT_AVATAR;
                            }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center text-xs font-semibold">
                            {user.name[0] || 'U'}
                          </div>
                        )}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                            user.status === 'online'
                              ? 'bg-emerald-500'
                              : user.status === 'in-call'
                              ? 'bg-purple-500'
                              : user.status === 'away'
                              ? 'bg-amber-500'
                              : 'bg-slate-600'
                          }`}
                        />
                      </div>

                      <div className="truncate text-left flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="truncate block font-semibold text-slate-200">{user.name}</span>
                          {user.username && (
                            <span className="text-[10px] text-slate-500 truncate">@{user.username}</span>
                          )}
                          {user.location && (
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {user.location.flag}
                            </span>
                          )}
                        </div>
                        
                        {/* Online Status / Last Seen Information */}
                        <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                          {isOnline ? (
                            <span className="text-emerald-400 font-medium">
                              {user.status === 'in-call' ? 'In Call' : 'Online'}
                            </span>
                          ) : (
                            <span className="text-slate-500">
                              {formatLastSeen(user.lastSeen)}
                            </span>
                          )}
                          {user.customStatus && (
                            <>
                              <span className="text-slate-600">·</span>
                              <span className="truncate">{user.customStatus}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right actions & unread badge */}
                    <div className="flex items-center gap-1 shrink-0">
                      {unread > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-bold mr-1">
                          {unread}
                        </span>
                      )}

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onStart1on1Call(user, 'audio');
                            if (onCloseMobile) onCloseMobile();
                          }}
                          title={`Voice Call ${user.name}`}
                          className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-emerald-400 transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onStart1on1Call(user, 'video');
                            if (onCloseMobile) onCloseMobile();
                          }}
                          title={`Video Call ${user.name}`}
                          className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-blue-400 transition-colors"
                        >
                          <Video className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Sidebar Info Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/80 text-[11px] text-slate-400 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Headphones className="w-3.5 h-3.5 text-blue-400" />
          <span>Elie Chat Global Hub</span>
        </span>
        <span className="text-emerald-400 text-[10px] font-medium flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {onlineCount !== undefined ? `${onlineCount} Online` : 'Live'}
        </span>
      </div>
    </aside>
  );
};
