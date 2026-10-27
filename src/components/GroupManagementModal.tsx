import React, { useState, useEffect } from 'react';
import { 
  X, 
  Users, 
  UserPlus, 
  Clock, 
  ShieldCheck, 
  Check, 
  AlertCircle, 
  Search, 
  Loader2, 
  Lock, 
  Globe, 
  LogOut,
  UserCheck,
  UserX
} from 'lucide-react';
import { Room, User, JoinRequest } from '../types';
import { 
  sendGroupInvitation, 
  subscribeGroupJoinRequests, 
  reviewJoinRequest,
  leaveGroup 
} from '../utils/groupWorkflow';

interface GroupManagementModalProps {
  group: Room;
  currentUser: User;
  allUsers: User[];
  onClose: () => void;
  onGroupUpdated?: () => void;
}

export const GroupManagementModal: React.FC<GroupManagementModalProps> = ({
  group,
  currentUser,
  allUsers,
  onClose,
  onGroupUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'invite' | 'requests'>('details');
  const [searchUser, setSearchUser] = useState('');
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const isCreatorOrAdmin = group.createdById === currentUser.id || (group.adminIds && group.adminIds.includes(currentUser.id));
  const isMember = group.memberIds ? group.memberIds.includes(currentUser.id) : true;

  // Subscribe to group join requests if creator/admin
  useEffect(() => {
    if (!isCreatorOrAdmin) return;
    const unsubscribe = subscribeGroupJoinRequests(group.id, (reqs) => {
      setJoinRequests(reqs);
    });
    return () => unsubscribe();
  }, [group.id, isCreatorOrAdmin]);

  // Filter users for inviting
  const currentMemberIds = group.memberIds || [group.createdById];
  const invitableUsers = allUsers.filter(
    (u) => u.id !== currentUser.id && !currentMemberIds.includes(u.id) &&
      (u.name.toLowerCase().includes(searchUser.toLowerCase()) ||
       (u.username && u.username.toLowerCase().includes(searchUser.toLowerCase())))
  );

  const handleSendInvite = async (targetUser: User) => {
    setIsActionLoading(true);
    setActionMessage(null);
    try {
      await sendGroupInvitation({
        group,
        inviter: currentUser,
        invitee: targetUser,
      });
      setActionMessage({ text: `Invitation sent to ${targetUser.name}!`, type: 'success' });
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Failed to send invitation.', type: 'error' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReview = async (req: JoinRequest, approve: boolean) => {
    setIsActionLoading(true);
    setActionMessage(null);
    try {
      await reviewJoinRequest({
        request: req,
        reviewer: currentUser,
        approve,
      });
      setActionMessage({
        text: approve ? `Approved ${req.requesterName} into group!` : `Rejected request from ${req.requesterName}.`,
        type: 'success',
      });
      if (onGroupUpdated) onGroupUpdated();
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Failed to process request.', type: 'error' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!window.confirm(`Are you sure you want to leave "${group.name}"?`)) return;
    setIsActionLoading(true);
    try {
      await leaveGroup(group.id, currentUser.id);
      if (onGroupUpdated) onGroupUpdated();
      onClose();
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Failed to leave group.', type: 'error' });
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm">
      <div 
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center text-lg font-bold">
              {group.icon || '👥'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white">{group.name}</h3>
                {group.isPrivate ? (
                  <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                    <Lock className="w-2.5 h-2.5" /> Private
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                    <Globe className="w-2.5 h-2.5" /> Public
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 line-clamp-1">{group.description || 'Channel Settings'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-1">
          <button
            onClick={() => { setActiveTab('details'); setActionMessage(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'details' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Members & Info
          </button>
          <button
            onClick={() => { setActiveTab('invite'); setActionMessage(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'invite' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Invite Members
          </button>
          {isCreatorOrAdmin && (
            <button
              onClick={() => { setActiveTab('requests'); setActionMessage(null); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors relative ${
                activeTab === 'requests' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Join Requests
              {joinRequests.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                  {joinRequests.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Tab Body */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {actionMessage && (
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              actionMessage.type === 'success' 
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' 
                : 'bg-red-500/10 border border-red-500/30 text-red-300'
            }`}>
              {actionMessage.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{actionMessage.text}</span>
            </div>
          )}

          {/* TAB 1: DETAILS & MEMBERS */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Created by:</span>
                  <span className="text-slate-200 font-medium">{group.createdByName || 'Elie Chat User'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Created at:</span>
                  <span className="text-slate-200">{new Date(group.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Total Members:</span>
                  <span className="text-slate-200 font-semibold">{currentMemberIds.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Joining Policy:</span>
                  <span className="text-slate-200">
                    {group.requiresApproval ? 'Requires Admin Approval' : 'Open to authorized users'}
                  </span>
                </div>
              </div>

              {/* Members List */}
              <div>
                <h4 className="text-xs font-semibold text-slate-300 mb-2">Group Members</h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {allUsers
                    .filter((u) => currentMemberIds.includes(u.id))
                    .map((m) => {
                      const isOwner = m.id === group.createdById;
                      return (
                        <div key={m.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-950/40 border border-slate-800/60">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={m.avatar || '/src/assets/images/avatar_elie_1790670827487.jpg'}
                              alt={m.name}
                              className="w-7 h-7 rounded-full object-cover"
                            />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium text-slate-200">{m.name}</span>
                                {isOwner && (
                                  <span className="text-[10px] px-1.5 rounded bg-blue-500/20 text-blue-300 font-semibold">
                                    Owner
                                  </span>
                                )}
                              </div>
                              {m.username && (
                                <span className="text-[10px] text-slate-500">@{m.username}</span>
                              )}
                            </div>
                          </div>
                          <span className={`text-[10px] flex items-center gap-1 ${
                            m.status === 'online' ? 'text-emerald-400' : 'text-slate-500'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${m.status === 'online' ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                            {m.status === 'online' ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Leave Group Action (if member and not owner) */}
              {isMember && group.createdById !== currentUser.id && (
                <div className="pt-2">
                  <button
                    onClick={handleLeave}
                    disabled={isActionLoading}
                    className="w-full py-2 px-3 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Leave Group
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: INVITE REGISTERED USERS */}
          {activeTab === 'invite' && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search registered users by name or @username..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {invitableUsers.length === 0 ? (
                  <p className="text-center text-xs text-slate-500 py-6">
                    {searchUser ? 'No matching users found.' : 'All registered users are already members.'}
                  </p>
                ) : (
                  invitableUsers.map((target) => (
                    <div key={target.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60 hover:border-slate-700 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={target.avatar || '/src/assets/images/avatar_elie_1790670827487.jpg'}
                          alt={target.name}
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-200 truncate">{target.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {target.username ? `@${target.username}` : target.email || 'Registered user'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSendInvite(target)}
                        disabled={isActionLoading}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors shadow-sm"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Invite</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: JOIN REQUESTS (ADMIN ONLY) */}
          {activeTab === 'requests' && isCreatorOrAdmin && (
            <div className="space-y-3">
              {joinRequests.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  <Clock className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
                  <p className="font-medium text-slate-400">No pending join requests</p>
                  <p className="text-[11px] mt-0.5">When users ask to join this group, their requests will appear here for your review.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {joinRequests.map((req) => (
                    <div key={req.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={req.requesterAvatar || '/src/assets/images/avatar_elie_1790670827487.jpg'}
                          alt={req.requesterName}
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-200 truncate">{req.requesterName}</p>
                          <p className="text-[10px] text-slate-500">
                            Requested {new Date(req.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleReview(req, true)}
                          disabled={isActionLoading}
                          className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1 shadow-sm"
                          title="Approve request"
                        >
                          <UserCheck className="w-4 h-4" />
                          <span className="hidden sm:inline">Approve</span>
                        </button>
                        <button
                          onClick={() => handleReview(req, false)}
                          disabled={isActionLoading}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 text-xs transition-colors"
                          title="Reject request"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
