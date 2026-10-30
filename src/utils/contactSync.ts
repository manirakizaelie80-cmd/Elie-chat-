import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where,
  arrayUnion,
  arrayRemove,
  deleteDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { User, ContactRequest, PublicUserProfile, UserPrivacySettings } from '../types';
import { normalizeUsername } from './auth';

/**
 * Search a user strictly by their exact unique username.
 * Protects user privacy: only returns public profile fields (name, username, avatar, status).
 * Never exposes email, location coordinates, or private details.
 */
export async function searchUserByExactUsername(rawUsername: string): Promise<PublicUserProfile | null> {
  const normalized = normalizeUsername(rawUsername);
  if (!normalized || normalized.length < 3) return null;

  try {
    const usernameDoc = await getDoc(doc(db, 'usernames', normalized));
    if (!usernameDoc.exists()) {
      return null;
    }

    const { uid } = usernameDoc.data() as { uid: string; username: string };
    if (!uid) return null;

    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) {
      return null;
    }

    const userData = userDoc.data() as User;

    return {
      id: userData.id,
      name: userData.name || normalized,
      username: userData.username || normalized,
      avatar: userData.avatar || '',
      customStatus: userData.customStatus,
    };
  } catch (error) {
    console.error('Error searching user by exact username:', error);
    return null;
  }
}

/**
 * Send a contact / chat request to another user by exact username or target user.
 */
export async function sendContactRequest(params: {
  sender: User;
  targetUser: PublicUserProfile;
}): Promise<{ success: boolean; message: string }> {
  const { sender, targetUser } = params;

  if (sender.id === targetUser.id) {
    return { success: false, message: 'You cannot add yourself as a contact.' };
  }

  // Check if target is already in contacts
  if (sender.contacts && sender.contacts.includes(targetUser.id)) {
    return { success: false, message: `${targetUser.name} is already in your contacts.` };
  }

  // Check if sender has blocked the user or user blocked sender
  if (sender.blockedUserIds && sender.blockedUserIds.includes(targetUser.id)) {
    return { success: false, message: 'You have blocked this user. Unblock them first to send a request.' };
  }

  const requestId = `req_${sender.id}_${targetUser.id}`;
  const requestRef = doc(db, 'contact_requests', requestId);

  try {
    const existing = await getDoc(requestRef);
    if (existing.exists()) {
      const data = existing.data() as ContactRequest;
      if (data.status === 'pending') {
        return { success: false, message: 'Contact request already pending.' };
      }
    }

    const contactReq: ContactRequest = {
      id: requestId,
      senderId: sender.id,
      senderName: sender.name,
      senderUsername: sender.username,
      senderAvatar: sender.avatar,
      receiverId: targetUser.id,
      receiverUsername: targetUser.username,
      status: 'pending',
      createdAt: Date.now(),
    };

    await setDoc(requestRef, contactReq);

    // Also send an In-App notification to the recipient
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await setDoc(doc(db, 'notifications', notifId), {
      id: notifId,
      recipientId: targetUser.id,
      type: 'contact_request',
      title: 'New Contact Request',
      message: `@${sender.username || sender.name} wants to connect with you.`,
      targetId: sender.id,
      isGroup: false,
      senderId: sender.id,
      senderName: sender.name,
      read: false,
      createdAt: Date.now(),
    });

    return { success: true, message: `Contact request sent to @${targetUser.username}!` };
  } catch (error) {
    console.error('Failed to send contact request:', error);
    return { success: false, message: 'Failed to send contact request. Please try again.' };
  }
}

/**
 * Subscribe to incoming contact requests where status is 'pending'
 */
export function subscribeIncomingContactRequests(
  userId: string,
  onUpdate: (requests: ContactRequest[]) => void
): () => void {
  const q = query(
    collection(db, 'contact_requests'),
    where('receiverId', '==', userId),
    where('status', '==', 'pending')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: ContactRequest[] = [];
      snapshot.forEach((snap) => {
        list.push(snap.data() as ContactRequest);
      });
      onUpdate(list.sort((a, b) => b.createdAt - a.createdAt));
    },
    (err) => {
      console.warn('Error subscribing to incoming contact requests:', err);
    }
  );
}

/**
 * Subscribe to outgoing sent contact requests
 */
export function subscribeSentContactRequests(
  userId: string,
  onUpdate: (requests: ContactRequest[]) => void
): () => void {
  const q = query(
    collection(db, 'contact_requests'),
    where('senderId', '==', userId),
    where('status', '==', 'pending')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: ContactRequest[] = [];
      snapshot.forEach((snap) => {
        list.push(snap.data() as ContactRequest);
      });
      onUpdate(list);
    },
    (err) => {
      console.warn('Error subscribing to sent contact requests:', err);
    }
  );
}

/**
 * Accept an incoming contact request.
 * Updates request status to 'accepted', and updates both users' contacts lists.
 */
export async function acceptContactRequest(request: ContactRequest): Promise<void> {
  const requestRef = doc(db, 'contact_requests', request.id);

  try {
    await updateDoc(requestRef, {
      status: 'accepted',
      respondedAt: Date.now(),
    });

    // Add each other to contacts
    const receiverRef = doc(db, 'users', request.receiverId);
    const senderRef = doc(db, 'users', request.senderId);

    await updateDoc(receiverRef, {
      contacts: arrayUnion(request.senderId),
    }).catch(console.error);

    await updateDoc(senderRef, {
      contacts: arrayUnion(request.receiverId),
    }).catch(console.error);

    // Notify sender that their request was accepted
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await setDoc(doc(db, 'notifications', notifId), {
      id: notifId,
      recipientId: request.senderId,
      type: 'contact_accepted',
      title: 'Contact Request Accepted',
      message: `${request.receiverUsername ? `@${request.receiverUsername}` : 'Your contact'} accepted your connection request. You can now chat!`,
      targetId: request.receiverId,
      isGroup: false,
      senderId: request.receiverId,
      read: false,
      createdAt: Date.now(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `contact_requests/${request.id}`);
  }
}

/**
 * Reject or dismiss a contact request.
 */
export async function rejectContactRequest(requestId: string): Promise<void> {
  const requestRef = doc(db, 'contact_requests', requestId);
  try {
    await updateDoc(requestRef, {
      status: 'rejected',
      respondedAt: Date.now(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `contact_requests/${requestId}`);
  }
}

/**
 * Remove an existing contact from a user's contact list.
 */
export async function removeContact(currentUserId: string, contactId: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', currentUserId);
    await updateDoc(userRef, {
      contacts: arrayRemove(contactId),
    });

    // Also remove from other user's list
    const otherRef = doc(db, 'users', contactId);
    await updateDoc(otherRef, {
      contacts: arrayRemove(currentUserId),
    }).catch(console.error);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${currentUserId}`);
  }
}

/**
 * Block an unwanted user.
 * Adds target user to blockedUserIds and removes from contacts.
 */
export async function blockUser(currentUserId: string, targetUserId: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', currentUserId);
    await updateDoc(userRef, {
      blockedUserIds: arrayUnion(targetUserId),
      contacts: arrayRemove(targetUserId),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${currentUserId}`);
  }
}

/**
 * Unblock a previously blocked user.
 */
export async function unblockUser(currentUserId: string, targetUserId: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', currentUserId);
    await updateDoc(userRef, {
      blockedUserIds: arrayRemove(targetUserId),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${currentUserId}`);
  }
}

/**
 * Update user privacy settings.
 */
export async function updatePrivacySettings(
  userId: string,
  settings: UserPrivacySettings
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      privacySettings: settings,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
  }
}

/**
 * Subscribe exclusively to a user's accepted contacts.
 * Instead of fetching all registered users, this fetches ONLY authorized contacts.
 * Respects online status & last seen privacy preferences!
 */
export function subscribeUserContactsRealtime(
  currentUserId: string,
  contactIds: string[],
  onUpdate: (contacts: User[]) => void
): () => void {
  if (!contactIds || contactIds.length === 0) {
    onUpdate([]);
    return () => {};
  }

  // Subscribe to individual contact documents
  const unsubscribers: (() => void)[] = [];
  const contactsMap = new Map<string, User>();

  contactIds.forEach((contactId) => {
    const contactRef = doc(db, 'users', contactId);
    const unsub = onSnapshot(
      contactRef,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data() as User;
          const privacy = d.privacySettings;
          const now = Date.now();
          const lastActiveTime = typeof d.lastActive === 'number' ? d.lastActive : 0;
          const isFresh = now - lastActiveTime < 45000;

          // Check online status privacy
          let computedStatus: User['status'] = 'offline';
          if (privacy?.showOnlineStatus === 'nobody') {
            computedStatus = 'offline';
          } else if (isFresh) {
            computedStatus = d.status || 'online';
          }

          // Check last seen privacy
          let lastSeenTime = typeof d.lastSeen === 'number' ? d.lastSeen : lastActiveTime;
          if (privacy?.showLastSeen === 'nobody') {
            lastSeenTime = 0;
          }

          contactsMap.set(contactId, {
            ...d,
            status: computedStatus,
            lastSeen: lastSeenTime,
          });
        } else {
          contactsMap.delete(contactId);
        }
        onUpdate(Array.from(contactsMap.values()));
      },
      (err) => {
        console.warn(`Error subscribing to contact ${contactId}:`, err);
      }
    );
    unsubscribers.push(unsub);
  });

  return () => {
    unsubscribers.forEach((u) => u());
  };
}
