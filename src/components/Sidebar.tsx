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
  ChevronRight
} from 'lucide-react';
import { Room, User, ActiveCall, GroupInvitation } from '../types';
import { formatLastSeen } from '../utils/userSync';

interface SidebarProps {
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
  onOpenGroupManagement?: (group: Room) => void;
  onRequestJoinGroup?: (group: Room) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
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
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter out current user from direct users
  const otherUsers = users.filter((u) => u.id !== currentUserId);

  const filteredRooms = rooms.filter((r) =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.description && r.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
    // If room is private and user is not a member, prompt to request join or open management
    const isMember = !room.isPrivate || (room.memberIds && room.memberIds.includes(currentUserId));
    if (!isMember) {
      if (onRequestJoinGroup) {
        onRequestJoinGroup(room);
      }
      return;
    }

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
                    className="p-1 px-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-semibold transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => onRespondInvitation(inv, false)}
                    className="p-1 px-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg text-[10px] transition-colors"
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

          <div className="space-y-0.5">
            {filteredRooms.length === 0 ? (
              <div className="px-2.5 py-3 text-center text-xs text-slate-500">
                No rooms match search
              </div>
            ) : (
              filteredRooms.map((room) => {
                const isSelected = activeRoomId === room.id && activeDirectUserId === null;
                const hasCall = Boolean(room.activeCall);
                const isCreator = room.createdById === currentUserId;
                const isMember = !room.isPrivate || (room.memberIds && room.memberIds.includes(currentUserId));
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
                        <span className="truncate block">{room.name}</span>
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

                      {/* Privacy indicator */}
                      {room.isPrivate && !isMember && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 border border-amber-500/30 flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> Request
                        </span>
                      )}

                      {room.isCustomGroup && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
                          Group
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

        {/* Section 2: Direct Messages (1-on-1) */}
        <div>
          <div className="px-2 mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">
              Direct Messages (1-on-1)
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold">
              {onlinePeersCount} online
            </span>
          </div>

          <div className="space-y-0.5">
            {filteredUsers.length === 0 ? (
              <div className="px-2 py-3 text-center text-xs text-slate-500">
                {otherUsers.length === 0 ? 'No registered peers yet.' : 'No users match search.'}
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
