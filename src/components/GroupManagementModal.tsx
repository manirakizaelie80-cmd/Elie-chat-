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
  UserX,
  Shield,
  Trash2,
  MailCheck,
  Ban
} from 'lucide-react';
import { Room, User, JoinRequest, GroupInvitation } from '../types';
import { 
  sendGroupInvitation, 
  subscribeGroupJoinRequests, 
  subscribeGroupPendingInvitations,
  reviewJoinRequest,
  revokeGroupInvitation,
  removeGroupMember,
  leaveGroup,
  isGroupAdmin,
  isGroupMember
} from '../utils/groupWorkflow';

interface GroupManagementModalProps {
  group: Room;
  currentUser: User;
  allUsers: User[];
  onClose: () => void;
  onGroupUpdated?: () => void;
  initialTab?: 'details' | 'invite' | 'requests' | 'invitations';
}

export const GroupManagementModal: React.FC<GroupManagementModalProps> = ({
  group,
  currentUser,
  allUsers,
  onClose,
  onGroupUpdated,
  initialTab = 'details',
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'invite' | 'requests' | 'invitations'>(initialTab);
  const [searchUser, setSearchUser] = useState('');
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<GroupInvitation[]>([]);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const isAdmin = isGroupAdmin(group, currentUser.id);
  const isMember = isGroupMember(group, currentUser.id);
  const isOwner = group.createdById === currentUser.id;

  // Real-time listener for join requests (Admin only)
  useEffect(() => {
    if (!isAdmin) return;
    const unsubscribe = subscribeGroupJoinRequests(group.id, (reqs) => {
      setJoinRequests(reqs);
    });
    return () => unsubscribe();
  }, [group.id, isAdmin]);

  // Real-time listener for pending invitations (Admins can view and revoke)
  useEffect(() => {
    if (!isAdmin) return;
    const unsubscribe = subscribeGroupPendingInvitations(group.id, (invs) => {
      setPendingInvitations(invs);
    });
    return () => unsubscribe();
  }, [group.id, isAdmin]);

  // Filter users for inviting
  const currentMemberIds = group.memberIds || [group.createdById];
  const invitableUsers = allUsers.filter(
    (u) =>
      u.id !== currentUser.id &&
      !currentMemberIds.includes(u.id) &&
      (u.name.toLowerCase().includes(searchUser.toLowerCase()) ||
        (u.username && u.username.toLowerCase().includes(searchUser.toLowerCase())))
  );

  // Invite action (ANY active member can invite)
  const handleSendInvite = async (targetUser: User) => {
    setIsActionLoading(true);
    setActionMessage(null);
    try {
      await sendGroupInvitation({
        group,
        inviter: currentUser,
        invitee: targetUser,
      });
      setActionMessage({ 
        text: `Invitation sent to ${targetUser.name} (@${targetUser.username || targetUser.name}).`, 
        type: 'success' 
      });
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Failed to send invitation.', type: 'error' });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Review join request (Admin only)
  const handleReviewRequest = async (req: JoinRequest, approve: boolean) => {
    if (!isAdmin) {
      setActionMessage({ text: 'Only group administrators can review join requests.', type: 'error' });
      return;
    }
    setIsActionLoading(true);
    setActionMessage(null);
    try {
      await reviewJoinRequest({
        request: req,
        reviewer: currentUser,
        approve,
      });
      setActionMessage({
        text: approve 
          ? `Approved ${req.requesterName} into group.` 
          : `Declined join request from ${req.requesterName}.`,
        type: 'success',
      });
      if (onGroupUpdated) onGroupUpdated();
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Failed to process request.', type: 'error' });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Revoke invitation (Admin only)
  const handleRevokeInvitation = async (invitationId: string, inviteeName?: string) => {
    if (!isAdmin) return;
    setIsActionLoading(true);
    setActionMessage(null);
    try {
      await revokeGroupInvitation(invitationId, currentUser);
      setActionMessage({
        text: `Revoked invitation for ${inviteeName || 'user'}.`,
        type: 'success',
      });
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Failed to revoke invitation.', type: 'error' });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Remove Member (Admin only)
  const handleRemoveMember = async (memberUser: User) => {
    if (!isAdmin) return;
    if (!window.confirm(`Are you sure you want to remove ${memberUser.name} from "${group.name}"?`)) {
      return;
    }
    setIsActionLoading(true);
    setActionMessage(null);
    try {
      await removeGroupMember({
        groupId: group.id,
        memberIdToRemove: memberUser.id,
        actor: currentUser,
      });
      setActionMessage({
        text: `Removed ${memberUser.name} from group.`,
        type: 'success',
      });
      if (onGroupUpdated) onGroupUpdated();
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Failed to remove member.', type: 'error' });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Leave Group (Regular member)
  const handleLeaveGroup = async () => {
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
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
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
                {isAdmin && (
                  <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium">
                    <Shield className="w-2.5 h-2.5" /> Admin
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 line-clamp-1">{group.description || 'Channel Settings & Members'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-1 shrink-0 overflow-x-auto">
          <button
            onClick={() => { setActiveTab('details'); setActionMessage(null); }}
            className={`flex-1 py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'details' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Members ({currentMemberIds.length})
          </button>

          {/* Any active member can invite */}
          {isMember && (
            <button
              onClick={() => { setActiveTab('invite'); setActionMessage(null); }}
              className={`flex-1 py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'invite' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 text-blue-400" />
              Invite Member
            </button>
          )}

          {/* Join Requests: ADMIN ONLY */}
          {isAdmin && (
            <button
              onClick={() => { setActiveTab('requests'); setActionMessage(null); }}
              className={`flex-1 py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors relative whitespace-nowrap ${
                activeTab === 'requests' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Join Requests
              {joinRequests.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                  {joinRequests.length}
                </span>
              )}
            </button>
          )}

          {/* Pending Invitations: ADMIN ONLY (or sent invitations) */}
          {isAdmin && (
            <button
              onClick={() => { setActiveTab('invitations'); setActionMessage(null); }}
              className={`flex-1 py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors relative whitespace-nowrap ${
                activeTab === 'invitations' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <MailCheck className="w-3.5 h-3.5 text-purple-400" />
              Sent Invites
              {pendingInvitations.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {pendingInvitations.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Tab Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
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
                  <span className="text-slate-400">Owner:</span>
                  <span className="text-slate-200 font-medium">{group.createdByName || 'Group Creator'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Created:</span>
                  <span className="text-slate-200">{new Date(group.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Total Members:</span>
                  <span className="text-slate-200 font-semibold">{currentMemberIds.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Approval Policy:</span>
                  <span className="text-slate-200">
                    {group.requiresApproval || group.isPrivate ? 'Admin Approval Required' : 'Open to authorized users'}
                  </span>
                </div>
              </div>

              {/* Members List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-slate-300">Active Group Members</h4>
                  <span className="text-[11px] text-slate-500">{currentMemberIds.length} members</span>
                </div>

                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {allUsers
                    .filter((u) => currentMemberIds.includes(u.id))
                    .map((m) => {
                      const userIsOwner = m.id === group.createdById;
                      const userIsAdmin = Array.isArray(group.adminIds) && group.adminIds.includes(m.id);
                      const canRemoveThisUser = isAdmin && !userIsOwner && (isOwner || !userIsAdmin) && m.id !== currentUser.id;

                      return (
                        <div key={m.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-950/40 border border-slate-800/60">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={m.avatar || '/src/assets/images/avatar_elie_1790670827487.jpg'}
                              alt={m.name}
                              className="w-7 h-7 rounded-full object-cover shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium text-slate-200 truncate">{m.name}</span>
                                {userIsOwner && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-semibold shrink-0">
                                    Owner
                                  </span>
                                )}
                                {!userIsOwner && userIsAdmin && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-semibold shrink-0">
                                    Admin
                                  </span>
                                )}
                              </div>
                              {m.username && (
                                <span className="text-[10px] text-slate-500 truncate block">@{m.username}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[10px] flex items-center gap-1 ${
                              m.status === 'online' ? 'text-emerald-400' : 'text-slate-500'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${m.status === 'online' ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                              {m.status === 'online' ? 'Online' : 'Offline'}
                            </span>

                            {canRemoveThisUser && (
                              <button
                                onClick={() => handleRemoveMember(m)}
                                disabled={isActionLoading}
                                title="Remove member from group"
                                className="p-1 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Leave Group Action (if member and not the owner) */}
              {isMember && !isOwner && (
                <div className="pt-2">
                  <button
                    onClick={handleLeaveGroup}
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

          {/* TAB 2: INVITE MEMBERS (EVERY ACTIVE MEMBER CAN INVITE) */}
          {activeTab === 'invite' && (
            <div className="space-y-3">
              <div className="p-3 bg-blue-950/20 border border-blue-800/30 rounded-xl">
                <p className="text-xs text-blue-300 font-medium">
                  Invite registered peers to #{group.name}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  As an active member, you can invite any registered user. They will receive a notification and must accept before joining.
                </p>
              </div>

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

              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {invitableUsers.length === 0 ? (
                  <p className="text-center text-xs text-slate-500 py-6">
                    {searchUser ? 'No matching users found.' : 'All registered users are already members of this group.'}
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
                        <span>Send Invite</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: JOIN REQUESTS (ADMIN ONLY) */}
          {activeTab === 'requests' && isAdmin && (
            <div className="space-y-3">
              <div className="p-3 bg-amber-950/20 border border-amber-800/30 rounded-xl">
                <p className="text-xs text-amber-300 font-medium">
                  Administrator Approval Required
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Only authorized administrators can approve or reject join requests. Approved users are immediately granted membership.
                </p>
              </div>

              {joinRequests.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  <Clock className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
                  <p className="font-medium text-slate-400">No pending join requests</p>
                  <p className="text-[11px] mt-0.5">When users request to join this group, their requests will appear here for administrator decision.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
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
                          onClick={() => handleReviewRequest(req, true)}
                          disabled={isActionLoading}
                          className="p-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
                          title="Approve request and add user to group"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleReviewRequest(req, false)}
                          disabled={isActionLoading}
                          className="p-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 text-xs font-medium transition-colors"
                          title="Reject request"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SENT INVITATIONS (ADMIN ONLY REVOCATION) */}
          {activeTab === 'invitations' && isAdmin && (
            <div className="space-y-3">
              <div className="p-3 bg-purple-950/20 border border-purple-800/30 rounded-xl">
                <p className="text-xs text-purple-300 font-medium">
                  Pending Sent Invitations
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  As an administrator, you can review and revoke outgoing invitations that are awaiting response.
                </p>
              </div>

              {pendingInvitations.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  <MailCheck className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
                  <p className="font-medium text-slate-400">No active pending invitations</p>
                  <p className="text-[11px] mt-0.5">Invitations sent by any group member that are awaiting acceptance will show here.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {pendingInvitations.map((inv) => (
                    <div key={inv.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-200 truncate">
                          Invited: {inv.inviteeName || inv.inviteeId}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Invited by {inv.inviterName} · {new Date(inv.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      <button
                        onClick={() => handleRevokeInvitation(inv.id, inv.inviteeName)}
                        disabled={isActionLoading}
                        className="px-2.5 py-1.5 rounded-lg border border-red-500/30 hover:bg-red-500/10 text-red-400 text-xs font-medium flex items-center gap-1 transition-colors shrink-0"
                        title="Revoke this invitation"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Revoke</span>
                      </button>
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
