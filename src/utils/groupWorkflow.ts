import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc,
  onSnapshot, 
  query, 
  where, 
  arrayUnion, 
  arrayRemove 
} from 'firebase/firestore';
import { db } from '../firebase';
import { GroupInvitation, JoinRequest, Room, User } from '../types';
import { createInAppNotification } from './notificationSync';

/**
 * Check if a user is an authorized administrator or owner of the group
 */
export function isGroupAdmin(group: Room, userId: string): boolean {
  if (!group || !userId) return false;
  const isOwner = group.createdById === userId;
  const isAdmin = Array.isArray(group.adminIds) && group.adminIds.includes(userId);
  return isOwner || isAdmin;
}

/**
 * Check if a user is an active authorized member of the group
 */
export function isGroupMember(group: Room, userId: string): boolean {
  if (!group || !userId) return false;
  if (!group.isPrivate) return true; // public room open to all
  const isOwner = group.createdById === userId;
  const inMembers = Array.isArray(group.memberIds) && group.memberIds.includes(userId);
  const inAdmins = Array.isArray(group.adminIds) && group.adminIds.includes(userId);
  return isOwner || inMembers || inAdmins;
}

/**
 * Every active group member can invite other registered users to the group.
 * Validates inviter membership, prevents duplicate invitations, duplicate memberships,
 * and self-invitation.
 */
export async function sendGroupInvitation(params: {
  group: Room;
  inviter: User;
  invitee: User;
}): Promise<void> {
  const { group, inviter, invitee } = params;

  if (invitee.id === inviter.id) {
    throw new Error('You cannot invite yourself to a group.');
  }

  // 1. Fetch fresh room state from database to verify inviter membership directly against DB
  const roomRef = doc(db, 'rooms', group.id);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) {
    throw new Error('Group no longer exists.');
  }
  const freshGroup = roomSnap.data() as Room;

  const inviterIsActiveMember = isGroupMember(freshGroup, inviter.id);
  if (!inviterIsActiveMember) {
    throw new Error('Only active members of this group are authorized to invite other users.');
  }

  // 2. Prevent inviting someone who is already a member
  const inviteeAlreadyMember = 
    freshGroup.createdById === invitee.id ||
    (Array.isArray(freshGroup.memberIds) && freshGroup.memberIds.includes(invitee.id)) ||
    (Array.isArray(freshGroup.adminIds) && freshGroup.adminIds.includes(invitee.id));

  if (inviteeAlreadyMember) {
    throw new Error(`${invitee.name} is already an active member of this group.`);
  }

  // 3. Prevent duplicate active pending invitations
  const invitationId = `inv_${freshGroup.id}_${invitee.id}`;
  const invitationRef = doc(db, 'group_invitations', invitationId);

  const existing = await getDoc(invitationRef);
  if (existing.exists() && existing.data().status === 'pending') {
    throw new Error(`An invitation has already been sent to ${invitee.name} and is awaiting their response.`);
  }

  // 4. Create pending invitation (never grants admin status automatically)
  const invitation: GroupInvitation = {
    id: invitationId,
    groupId: freshGroup.id,
    groupName: freshGroup.name,
    groupIcon: freshGroup.icon || '👥',
    inviterId: inviter.id,
    inviterName: inviter.name,
    inviteeId: invitee.id,
    inviteeName: invitee.name,
    status: 'pending',
    createdAt: Date.now(),
  };

  await setDoc(invitationRef, invitation);

  // 5. Send real-time notification to the invited user
  await createInAppNotification({
    recipientId: invitee.id,
    type: 'invitation',
    title: 'Group Invitation',
    message: `${inviter.name} invited you to join "${freshGroup.name}".`,
    targetId: freshGroup.id,
    isGroup: true,
    senderId: inviter.id,
    senderName: inviter.name,
  }).catch(console.error);
}

/**
 * Subscribe to invitations received by a specific user
 */
export function subscribeUserInvitations(
  userId: string,
  callback: (invitations: GroupInvitation[]) => void
): () => void {
  const q = query(
    collection(db, 'group_invitations'),
    where('inviteeId', '==', userId),
    where('status', '==', 'pending')
  );

  return onSnapshot(q, (snapshot) => {
    const list: GroupInvitation[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as GroupInvitation);
    });
    list.sort((a, b) => b.createdAt - a.createdAt);
    callback(list);
  }, (err) => {
    console.error('Error fetching invitations:', err);
  });
}

/**
 * Subscribe to pending invitations sent for a specific group (for admins to inspect/revoke)
 */
export function subscribeGroupPendingInvitations(
  groupId: string,
  callback: (invitations: GroupInvitation[]) => void
): () => void {
  const q = query(
    collection(db, 'group_invitations'),
    where('groupId', '==', groupId),
    where('status', '==', 'pending')
  );

  return onSnapshot(q, (snapshot) => {
    const list: GroupInvitation[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as GroupInvitation);
    });
    list.sort((a, b) => b.createdAt - a.createdAt);
    callback(list);
  }, (err) => {
    console.error('Error fetching group invitations:', err);
  });
}

/**
 * Accept or decline an invitation. The invited user MUST accept before becoming a member.
 * Does NOT grant administrator privileges.
 */
export async function respondToInvitation(
  invitation: GroupInvitation,
  currentUser: User,
  accept: boolean
): Promise<void> {
  if (invitation.inviteeId !== currentUser.id) {
    throw new Error('Unauthorized: You can only respond to invitations sent to your own account.');
  }

  const invRef = doc(db, 'group_invitations', invitation.id);
  const invSnap = await getDoc(invRef);
  if (!invSnap.exists()) {
    throw new Error('This invitation no longer exists.');
  }
  const currentData = invSnap.data() as GroupInvitation;
  if (currentData.status !== 'pending') {
    throw new Error(`This invitation has already been ${currentData.status}.`);
  }

  const status = accept ? 'accepted' : 'declined';

  await updateDoc(invRef, {
    status,
    respondedAt: Date.now(),
  });

  if (accept) {
    const roomRef = doc(db, 'rooms', invitation.groupId);
    // Add user strictly to memberIds (regular member privileges only)
    await updateDoc(roomRef, {
      memberIds: arrayUnion(currentUser.id),
    });

    // Notify inviter that invitation was accepted
    await createInAppNotification({
      recipientId: invitation.inviterId,
      type: 'request_approved',
      title: 'Invitation Accepted',
      message: `${currentUser.name} accepted your invitation to join "${invitation.groupName}".`,
      targetId: invitation.groupId,
      isGroup: true,
      senderId: currentUser.id,
      senderName: currentUser.name,
    }).catch(console.error);
  }
}

/**
 * Revoke an outgoing group invitation.
 * Allowed ONLY for group administrators or the original inviter.
 */
export async function revokeGroupInvitation(
  invitationId: string,
  actor: User
): Promise<void> {
  const invRef = doc(db, 'group_invitations', invitationId);
  const invSnap = await getDoc(invRef);
  if (!invSnap.exists()) {
    throw new Error('Invitation not found.');
  }
  const invitation = invSnap.data() as GroupInvitation;

  const roomRef = doc(db, 'rooms', invitation.groupId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) {
    throw new Error('Associated group not found.');
  }
  const group = roomSnap.data() as Room;

  const isAdminOrOwner = isGroupAdmin(group, actor.id);
  const isInviter = invitation.inviterId === actor.id;

  if (!isAdminOrOwner && !isInviter) {
    throw new Error('Permission denied: Only group administrators or the original inviter can revoke invitations.');
  }

  await updateDoc(invRef, {
    status: 'revoked',
    revokedBy: actor.id,
    revokedAt: Date.now(),
  });
}

/**
 * Request to Join a group.
 * The request remains in PENDING status until an authorized administrator approves or rejects it.
 * Notifies all group administrators.
 */
export async function createJoinRequest(
  group: Room,
  requester: User
): Promise<void> {
  const roomRef = doc(db, 'rooms', group.id);
  const roomSnap = await getDoc(roomRef);
  const freshGroup = roomSnap.exists() ? (roomSnap.data() as Room) : group;

  if (isGroupMember(freshGroup, requester.id)) {
    throw new Error('You are already an active member of this group.');
  }

  const requestId = `req_${freshGroup.id}_${requester.id}`;
  const reqRef = doc(db, 'join_requests', requestId);

  const existing = await getDoc(reqRef);
  if (existing.exists() && existing.data().status === 'pending') {
    throw new Error('You have already submitted a join request. Please wait for an administrator to review it.');
  }

  const joinReq: JoinRequest = {
    id: requestId,
    groupId: freshGroup.id,
    groupName: freshGroup.name,
    requesterId: requester.id,
    requesterName: requester.name,
    requesterAvatar: requester.avatar,
    status: 'pending',
    createdAt: Date.now(),
  };

  await setDoc(reqRef, joinReq);

  // Notify all group administrators and owner
  const adminsToNotify = new Set<string>();
  if (freshGroup.createdById) adminsToNotify.add(freshGroup.createdById);
  if (Array.isArray(freshGroup.adminIds)) {
    freshGroup.adminIds.forEach((adminId) => adminsToNotify.add(adminId));
  }

  for (const adminId of adminsToNotify) {
    if (adminId !== requester.id) {
      await createInAppNotification({
        recipientId: adminId,
        type: 'join_request',
        title: 'New Join Request',
        message: `${requester.name} requested to join "${freshGroup.name}".`,
        targetId: freshGroup.id,
        isGroup: true,
        senderId: requester.id,
        senderName: requester.name,
      }).catch(console.error);
    }
  }
}

/**
 * Subscribe to pending join requests for a group (authorized admins only)
 */
export function subscribeGroupJoinRequests(
  groupId: string,
  callback: (requests: JoinRequest[]) => void
): () => void {
  const q = query(
    collection(db, 'join_requests'),
    where('groupId', '==', groupId),
    where('status', '==', 'pending')
  );

  return onSnapshot(q, (snapshot) => {
    const list: JoinRequest[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as JoinRequest);
    });
    list.sort((a, b) => b.createdAt - a.createdAt);
    callback(list);
  }, (err) => {
    console.error('Error fetching join requests:', err);
  });
}

/**
 * Subscribe to current user's submitted join requests
 */
export function subscribeUserJoinRequests(
  userId: string,
  callback: (requests: JoinRequest[]) => void
): () => void {
  const q = query(
    collection(db, 'join_requests'),
    where('requesterId', '==', userId)
  );

  return onSnapshot(q, (snapshot) => {
    const list: JoinRequest[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as JoinRequest);
    });
    callback(list);
  }, (err) => {
    console.error('Error fetching user requests:', err);
  });
}

/**
 * Review Join Request (Approve or Reject).
 * CRITICAL RULE: ONLY the group owner or an authorized group administrator can approve or reject.
 * Regular members are strictly prohibited from approving or rejecting join requests.
 * Validates against database records, not client-supplied assertions.
 */
export async function reviewJoinRequest(params: {
  request: JoinRequest;
  reviewer: User;
  approve: boolean;
}): Promise<void> {
  const { request, reviewer, approve } = params;

  // 1. Fetch fresh room state directly from Firestore to verify actual administrator status
  const roomRef = doc(db, 'rooms', request.groupId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) {
    throw new Error('The group no longer exists.');
  }

  const group = roomSnap.data() as Room;
  const isAuthorizedAdmin = isGroupAdmin(group, reviewer.id);

  if (!isAuthorizedAdmin) {
    throw new Error('Access denied: Only authorized group administrators or the owner can approve or reject join requests.');
  }

  // 2. Verify request exists and is currently pending
  const reqRef = doc(db, 'join_requests', request.id);
  const reqSnap = await getDoc(reqRef);
  if (!reqSnap.exists()) {
    throw new Error('Join request no longer exists.');
  }
  const currentReq = reqSnap.data() as JoinRequest;
  if (currentReq.status !== 'pending') {
    throw new Error(`This join request has already been ${currentReq.status}.`);
  }

  const status = approve ? 'approved' : 'rejected';

  // 3. Update join request status
  await updateDoc(reqRef, {
    status,
    reviewedBy: reviewer.id,
    reviewedAt: Date.now(),
  });

  // 4. If approved, add user to group's active membership list
  if (approve) {
    await updateDoc(roomRef, {
      memberIds: arrayUnion(request.requesterId),
    });
  }

  // 5. Notify requester of decision
  await createInAppNotification({
    recipientId: request.requesterId,
    type: approve ? 'request_approved' : 'request_rejected',
    title: approve ? 'Join Request Approved! 🎉' : 'Join Request Update',
    message: approve 
      ? `You have been approved as a member of "${request.groupName}". Welcome!`
      : `Your request to join "${request.groupName}" was declined.`,
    targetId: request.groupId,
    isGroup: true,
    senderId: reviewer.id,
    senderName: reviewer.name,
  }).catch(console.error);
}

/**
 * Remove a member from a group (Admin only).
 * Regular members cannot remove members. Admins cannot remove the owner.
 */
export async function removeGroupMember(params: {
  groupId: string;
  memberIdToRemove: string;
  actor: User;
}): Promise<void> {
  const { groupId, memberIdToRemove, actor } = params;

  const roomRef = doc(db, 'rooms', groupId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) throw new Error('Group not found.');
  const group = roomSnap.data() as Room;

  const isOwner = group.createdById === actor.id;
  const isAdmin = Array.isArray(group.adminIds) && group.adminIds.includes(actor.id);

  if (!isOwner && !isAdmin) {
    throw new Error('Only authorized group administrators can remove members.');
  }

  if (memberIdToRemove === group.createdById) {
    throw new Error('Cannot remove the group owner.');
  }

  const isTargetAdmin = Array.isArray(group.adminIds) && group.adminIds.includes(memberIdToRemove);
  if (isTargetAdmin && !isOwner) {
    throw new Error('Only the group owner can remove an administrator.');
  }

  await updateDoc(roomRef, {
    memberIds: arrayRemove(memberIdToRemove),
    adminIds: arrayRemove(memberIdToRemove),
  });
}

/**
 * Join public group immediately
 */
export async function joinPublicGroup(groupId: string, user: User): Promise<void> {
  const roomRef = doc(db, 'rooms', groupId);
  await updateDoc(roomRef, {
    memberIds: arrayUnion(user.id),
  });
}

/**
 * Leave group
 */
export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  const roomRef = doc(db, 'rooms', groupId);
  await updateDoc(roomRef, {
    memberIds: arrayRemove(userId),
    adminIds: arrayRemove(userId),
  });
}
