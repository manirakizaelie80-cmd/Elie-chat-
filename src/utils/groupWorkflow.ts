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

// Send Group Invitation
export async function sendGroupInvitation(params: {
  group: Room;
  inviter: User;
  invitee: User;
}): Promise<void> {
  const { group, inviter, invitee } = params;

  // Prevent inviting user who is already a member
  if (group.memberIds && group.memberIds.includes(invitee.id)) {
    throw new Error(`${invitee.name} is already a member of this group.`);
  }

  const invitationId = `inv_${group.id}_${invitee.id}`;
  const invitationRef = doc(db, 'group_invitations', invitationId);

  const existing = await getDoc(invitationRef);
  if (existing.exists() && existing.data().status === 'pending') {
    throw new Error(`An invitation has already been sent to ${invitee.name}.`);
  }

  const invitation: GroupInvitation = {
    id: invitationId,
    groupId: group.id,
    groupName: group.name,
    groupIcon: group.icon || '👥',
    inviterId: inviter.id,
    inviterName: inviter.name,
    inviteeId: invitee.id,
    inviteeName: invitee.name,
    status: 'pending',
    createdAt: Date.now(),
  };

  await setDoc(invitationRef, invitation);

  // Send real-time notification to invitee
  await createInAppNotification({
    recipientId: invitee.id,
    type: 'invitation',
    title: 'Group Invitation',
    message: `${inviter.name} invited you to join "${group.name}".`,
    targetId: group.id,
    isGroup: true,
    senderId: inviter.id,
    senderName: inviter.name,
  }).catch(console.error);
}

// Subscribe to invitations for current user
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

// Accept or decline an invitation
export async function respondToInvitation(
  invitation: GroupInvitation,
  currentUser: User,
  accept: boolean
): Promise<void> {
  const invRef = doc(db, 'group_invitations', invitation.id);
  const status = accept ? 'accepted' : 'declined';

  await updateDoc(invRef, {
    status,
    respondedAt: Date.now(),
  });

  if (accept) {
    const roomRef = doc(db, 'rooms', invitation.groupId);
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

// Request to Join a group
export async function createJoinRequest(
  group: Room,
  requester: User
): Promise<void> {
  const requestId = `req_${group.id}_${requester.id}`;
  const reqRef = doc(db, 'join_requests', requestId);

  const existing = await getDoc(reqRef);
  if (existing.exists() && existing.data().status === 'pending') {
    throw new Error('You have already submitted a request to join this group. Please wait for an administrator to review it.');
  }

  const joinReq: JoinRequest = {
    id: requestId,
    groupId: group.id,
    groupName: group.name,
    requesterId: requester.id,
    requesterName: requester.name,
    requesterAvatar: requester.avatar,
    status: 'pending',
    createdAt: Date.now(),
  };

  await setDoc(reqRef, joinReq);

  // Notify group creator / admins
  const adminsToNotify = group.adminIds && group.adminIds.length > 0 
    ? group.adminIds 
    : [group.createdById];

  for (const adminId of adminsToNotify) {
    await createInAppNotification({
      recipientId: adminId,
      type: 'join_request',
      title: 'New Join Request',
      message: `${requester.name} requested to join "${group.name}".`,
      targetId: group.id,
      isGroup: true,
      senderId: requester.id,
      senderName: requester.name,
    }).catch(console.error);
  }
}

// Subscribe to pending join requests for a group
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

// Subscribe to current user's submitted join requests
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

// Review Join Request (Approve / Reject)
export async function reviewJoinRequest(params: {
  request: JoinRequest;
  reviewer: User;
  approve: boolean;
}): Promise<void> {
  const { request, reviewer, approve } = params;
  const reqRef = doc(db, 'join_requests', request.id);
  const status = approve ? 'approved' : 'rejected';

  await updateDoc(reqRef, {
    status,
    reviewedBy: reviewer.id,
    reviewedAt: Date.now(),
  });

  if (approve) {
    const roomRef = doc(db, 'rooms', request.groupId);
    await updateDoc(roomRef, {
      memberIds: arrayUnion(request.requesterId),
    });
  }

  // Notify requester
  await createInAppNotification({
    recipientId: request.requesterId,
    type: approve ? 'request_approved' : 'request_rejected',
    title: approve ? 'Join Request Approved! 🎉' : 'Join Request Update',
    message: approve 
      ? `You have been accepted into "${request.groupName}". Welcome!`
      : `Your request to join "${request.groupName}" was declined.`,
    targetId: request.groupId,
    isGroup: true,
    senderId: reviewer.id,
    senderName: reviewer.name,
  }).catch(console.error);
}

// Join public group immediately
export async function joinPublicGroup(groupId: string, user: User): Promise<void> {
  const roomRef = doc(db, 'rooms', groupId);
  await updateDoc(roomRef, {
    memberIds: arrayUnion(user.id),
  });
}

// Leave group
export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  const roomRef = doc(db, 'rooms', groupId);
  await updateDoc(roomRef, {
    memberIds: arrayRemove(userId),
    adminIds: arrayRemove(userId),
  });
}
