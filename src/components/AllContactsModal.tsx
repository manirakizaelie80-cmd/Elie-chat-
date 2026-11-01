import React, { useState } from 'react';
import { 
  X, 
  Search, 
  UserPlus, 
  MessageSquare, 
  Phone, 
  Video, 
  Trash2, 
  Users, 
  ShieldCheck, 
  MapPin, 
  Clock, 
  CheckCircle2,
  Sparkles,
  ExternalLink,
  UserX
} from 'lucide-react';
import { User } from '../types';
import { formatLastSeen } from '../utils/userSync';
import { DEFAULT_AVATAR } from '../utils/photoUpload';

interface AllContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  contacts: User[];
  unreadCounts?: Record<string, number>;
  onSelectDirectUser: (userId: string) => void;
  onStartCall: (targetUser: User, type: 'audio' | 'video') => void;
  onRemoveContact: (contactId: string) => void;
  onOpenAddContact: () => void;
}

export const AllContactsModal: React.FC<AllContactsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  contacts,
  unreadCounts = {},
  onSelectDirectUser,
  onStartCall,
  onRemoveContact,
  onOpenAddContact,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'online'>('all');
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter out self if present
  const otherContacts = contacts.filter((c) => c.id !== currentUser.id);

  // Online contacts
  const onlineContacts = otherContacts.filter(
    (c) => c.status === 'online' || c.status === 'in-call' || c.status === 'busy'
  );

  const displayedList = (activeFilter === 'online' ? onlineContacts : otherContacts).filter((c) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.username && c.username.toLowerCase().includes(q)) ||
      (c.customStatus && c.customStatus.toLowerCase().includes(q)) ||
      (c.location?.city && c.location.city.toLowerCase().includes(q)) ||
      (c.location?.country && c.location.country.toLowerCase().includes(q))
    );
  });

  const handleOpenChat = (userId: string) => {
    onSelectDirectUser(userId);
    onClose();
  };

  const handleStartCall = (targetUser: User, type: 'audio' | 'video') => {
    onStartCall(targetUser, type);
    onClose();
  };

  const handleConfirmRemove = (contactId: string) => {
    onRemoveContact(contactId);
    setConfirmRemoveId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">All My Known Contacts</h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 text-xs font-bold">
                  {otherContacts.length}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Authorized private contacts connected to <span className="text-slate-200 font-medium">@{currentUser.username || currentUser.name}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenAddContact();
              }}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm shadow-blue-500/20"
              title="Add a new contact by exact username"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add Contact</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Bar & Search */}
        <div className="p-3 sm:p-4 border-b border-slate-800/80 bg-slate-950/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search contacts by name, @username, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({otherContacts.length})
            </button>
            <button
              onClick={() => setActiveFilter('online')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeFilter === 'online'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Online ({onlineContacts.length})
            </button>
          </div>
        </div>

        {/* Contacts List */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-2.5 flex-1">
          {displayedList.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-14 h-14 rounded-3xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-slate-200">
                {otherContacts.length === 0
                  ? 'No contacts saved yet'
                  : 'No contacts match your search'}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                {otherContacts.length === 0
                  ? 'Connect with people you know privately using their exact unique @username.'
                  : `No contacts found matching "${searchTerm}". Try checking for typos.`}
              </p>
              {otherContacts.length === 0 && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenAddContact();
                  }}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Find Person by @Username</span>
                </button>
              )}
            </div>
          ) : (
            displayedList.map((contact) => {
              const isOnline = contact.status === 'online' || contact.status === 'in-call';
              const convId = [currentUser.id, contact.id].sort().join('__');
              const unread = unreadCounts[convId] || 0;
              const isRemoving = confirmRemoveId === contact.id;

              return (
                <div
                  key={contact.id}
                  className="p-3 sm:p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  {/* Left: Avatar & Info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="relative shrink-0">
                      <img
                        src={contact.avatar || DEFAULT_AVATAR}
                        alt={contact.name}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded-2xl object-cover border border-slate-800"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = DEFAULT_AVATAR;
                        }}
                      />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                          contact.status === 'online'
                            ? 'bg-emerald-500 ring-2 ring-emerald-500/20'
                            : contact.status === 'in-call'
                            ? 'bg-purple-500'
                            : contact.status === 'away'
                            ? 'bg-amber-500'
                            : 'bg-slate-600'
                        }`}
                      />
                    </div>

                    <div className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-slate-100 truncate">
                          {contact.name}
                        </span>
                        {contact.username && (
                          <span className="text-xs text-blue-400 font-medium truncate">
                            @{contact.username}
                          </span>
                        )}
                        {contact.location && (
                          <span className="text-xs text-slate-400 flex items-center gap-0.5 shrink-0">
                            <span>{contact.location.flag}</span>
                            <span className="text-[11px] text-slate-400">{contact.location.city}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                        {isOnline ? (
                          <span className="text-emerald-400 font-medium flex items-center gap-1 text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {contact.status === 'in-call' ? 'In Call' : 'Online now'}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatLastSeen(contact.lastSeen)}
                          </span>
                        )}

                        {contact.customStatus && (
                          <>
                            <span className="text-slate-600">·</span>
                            <span className="truncate text-slate-400 text-[11px]">
                              {contact.customStatus}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60 justify-end">
                    {/* Unread Pill */}
                    {unread > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                        {unread} unread
                      </span>
                    )}

                    {/* Chat Button */}
                    <button
                      onClick={() => handleOpenChat(contact.id)}
                      className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      title="Open private chat"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                      <span>Chat</span>
                    </button>

                    {/* Audio Call */}
                    <button
                      onClick={() => handleStartCall(contact, 'audio')}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-800 hover:border-slate-700 transition-colors"
                      title="Start voice call"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </button>

                    {/* Video Call */}
                    <button
                      onClick={() => handleStartCall(contact, 'video')}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-blue-400 border border-slate-800 hover:border-slate-700 transition-colors"
                      title="Start video call"
                    >
                      <Video className="w-3.5 h-3.5" />
                    </button>

                    {/* Remove Contact Action */}
                    {isRemoving ? (
                      <div className="flex items-center gap-1 bg-red-950/80 p-1 rounded-xl border border-red-500/40">
                        <span className="text-[10px] text-red-200 px-1">Remove?</span>
                        <button
                          onClick={() => handleConfirmRemove(contact.id)}
                          className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold hover:bg-red-500"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmRemoveId(null)}
                          className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRemoveId(contact.id)}
                        className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Remove from contacts"
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info banner */}
        <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Private Directory: Only you and approved contacts can communicate</span>
          </div>
          <span className="text-[11px] font-medium text-slate-400">
            {otherContacts.length} total contact{otherContacts.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>
  );
};
