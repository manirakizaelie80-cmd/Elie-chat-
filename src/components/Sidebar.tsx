import React, { useState } from 'react';
import { 
  Hash, 
  Video, 
  Plus, 
  Phone, 
  Search, 
  Mic, 
  MicOff, 
  Radio, 
  Sparkles, 
  CircleDot, 
  Headphones 
} from 'lucide-react';
import { Room, User, ActiveCall } from '../types';

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
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Other users (filter out current user)
  const otherUsers = users.filter((u) => u.id !== currentUserId);

  const filteredRooms = rooms.filter((r) =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = otherUsers.filter((u) =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <aside className="w-64 md:w-72 bg-slate-900/90 border-r border-slate-800 flex flex-col h-full shrink-0 select-none">
      {/* Search Bar */}
      <div className="p-3 border-b border-slate-800">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search channels & peers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

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
                  className="flex items-center justify-between p-2 rounded-md bg-slate-800/60 border border-emerald-900/50 text-xs"
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
                        if (room) onJoinRoomCall(room);
                      }}
                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-medium whitespace-nowrap transition-colors"
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

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-6">
        {/* Section 1: Channels & Live Stages */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">
              Group Rooms & Stages
            </span>
            <button
              onClick={onCreateChannelClick}
              title="Create new room"
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-0.5">
            {filteredRooms.map((room) => {
              const isSelected = activeRoomId === room.id && activeDirectUserId === null;
              const hasCall = Boolean(room.activeCall);

              return (
                <button
                  key={room.id}
                  onClick={() => onSelectRoom(room.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors group ${
                    isSelected
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {room.type === 'voice-video' ? (
                      <Video className={`w-3.5 h-3.5 shrink-0 ${hasCall ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
                    ) : (
                      <Hash className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    )}
                    <span className="truncate">{room.name}</span>
                  </div>

                  {hasCall && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                      LIVE
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Direct Messages (1-on-1) */}
        <div>
          <div className="px-2 mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">
              Direct Messages (1-on-1)
            </span>
            <span className="text-[10px] text-slate-500">
              {otherUsers.filter(u => u.status === 'online').length} online
            </span>
          </div>

          <div className="space-y-0.5">
            {filteredUsers.length === 0 ? (
              <div className="px-2 py-3 text-center text-xs text-slate-500">
                No peers online yet. Open in a new tab to test!
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isSelected = activeDirectUserId === user.id;

                return (
                  <div
                    key={user.id}
                    onClick={() => onSelectDirectUser(user.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors group ${
                      isSelected
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="relative shrink-0">
                        {user.avatar ? (
                          <img
                            src={user.avatar}
                            alt={user.name}
                            referrerPolicy="no-referrer"
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center text-[10px] font-semibold">
                            {user.name[0] || 'U'}
                          </div>
                        )}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-900 ${
                            user.status === 'online'
                              ? 'bg-emerald-500'
                              : user.status === 'in-call'
                              ? 'bg-purple-500'
                              : 'bg-amber-500'
                          }`}
                        />
                      </div>
                      <div className="truncate text-left">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="truncate block font-medium">{user.name}</span>
                          {user.location && (
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {user.location.flag} {user.location.city}
                            </span>
                          )}
                        </div>
                        {user.customStatus ? (
                          <span className="text-[10px] text-slate-500 truncate block">
                            {user.customStatus}
                          </span>
                        ) : user.location ? (
                          <span className="text-[10px] text-slate-500 truncate block">
                            {user.location.country}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Quick Call Action Buttons */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStart1on1Call(user, 'audio');
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
                        }}
                        title={`Video Call ${user.name}`}
                        className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-blue-400 transition-colors"
                      >
                        <Video className="w-3.5 h-3.5" />
                      </button>
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
          <span>Global P2P Mesh</span>
        </span>
        <span className="text-blue-400 text-[10px] font-medium">🌍 Worldwide</span>
      </div>
    </aside>
  );
};
