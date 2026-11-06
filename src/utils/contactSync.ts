import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  limit,
  arrayUnion, 
  arrayRemove, 
  deleteDoc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { User, ContactRequest, PublicUserProfile, UserPrivacySettings, Contact } from '../types';
import { normalizeUsername } from './auth';
import { computeUserLiveStatus } from './userSync';

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
    where('status', '==', 'pending'),
    limit(50)
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
    where('status', '==', 'pending'),
    limit(50)
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
 * Creates PERMANENT bilateral database records in Firestore /contacts collection
 * so contacts NEVER disappear after logout, refresh, or session restart.
 */
export async function acceptContactRequest(request: ContactRequest): Promise<void> {
  const requestRef = doc(db, 'contact_requests', request.id);
  const now = Date.now();

  try {
    await updateDoc(requestRef, {
      status: 'accepted',
      respondedAt: now,
    });

    // 1. Permanent contact document for receiver (receiver owns contact sender)
    const receiverContactId = `${request.receiverId}_${request.senderId}`;
    await setDoc(doc(db, 'contacts', receiverContactId), {
      id: receiverContactId,
      userId: request.receiverId,
      contactId: request.senderId,
      contactName: request.senderName,
      contactUsername: request.senderUsername || '',
      contactAvatar: request.senderAvatar || '',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }, { merge: true });

    // 2. Permanent contact document for sender (sender owns contact receiver)
    const senderContactId = `${request.senderId}_${request.receiverId}`;
    await setDoc(doc(db, 'contacts', senderContactId), {
      id: senderContactId,
      userId: request.senderId,
      contactId: request.receiverId,
      contactName: request.receiverUsername || 'User',
      contactUsername: request.receiverUsername || '',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }, { merge: true });

    // 3. Dual update in users collection for array compatibility
    const receiverRef = doc(db, 'users', request.receiverId);
    const senderRef = doc(db, 'users', request.senderId);

    await updateDoc(receiverRef, {
      contacts: arrayUnion(request.senderId),
    }).catch(console.error);

    await updateDoc(senderRef, {
      contacts: arrayUnion(request.receiverId),
    }).catch(console.error);

    // 4. Notify sender that their request was accepted
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
 * Remove an existing contact from a user's permanent contact list.
 */
export async function removeContact(currentUserId: string, contactId: string): Promise<void> {
  try {
    // Delete permanent contact records from Firestore /contacts collection
    await deleteDoc(doc(db, 'contacts', `${currentUserId}_${contactId}`)).catch(console.error);
    await deleteDoc(doc(db, 'contacts', `${contactId}_${currentUserId}`)).catch(console.error);

    // Update user document arrays
    const userRef = doc(db, 'users', currentUserId);
    await updateDoc(userRef, {
      contacts: arrayRemove(contactId),
    });

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
    await deleteDoc(doc(db, 'contacts', `${currentUserId}_${targetUserId}`)).catch(console.error);
    await deleteDoc(doc(db, 'contacts', `${targetUserId}_${currentUserId}`)).catch(console.error);

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
 * Subscribe permanently to a user's approved contacts.
 * Listens directly to Firestore permanent /contacts collection for the given userId.
 * Automatically backfills and synchronizes contacts from user.contacts legacy array.
 * Subscribes to each contact user's real-time presence, photo, and profile updates.
 */
export function subscribeUserContactsRealtime(
  currentUserId: string,
  callback: (contacts: User[]) => void
): () => void;
export function subscribeUserContactsRealtime(
  currentUserId: string,
  legacyContactIds: string[],
  callback: (contacts: User[]) => void
): () => void;
export function subscribeUserContactsRealtime(
  currentUserId: string,
  arg2: string[] | ((contacts: User[]) => void),
  arg3?: (contacts: User[]) => void
): () => void {
  const onUpdate: (contacts: User[]) => void = typeof arg3 === 'function' ? arg3 : (typeof arg2 === 'function' ? arg2 : () => {});
  const legacyContactIds: string[] = Array.isArray(arg2) ? arg2 : [];

  if (!currentUserId) {
    if (typeof onUpdate === 'function') onUpdate([]);
    return () => {};
  }

  const contactUserUnsubs = new Map<string, () => void>();
  const contactsMap = new Map<string, User>();
  const activeContactIds = new Set<string>();

  const emitContacts = () => {
    if (typeof onUpdate === 'function') {
      const list = Array.from(contactsMap.values());
      onUpdate(list);
    }
  };

  const syncContactUserDoc = (contactId: string) => {
    if (contactUserUnsubs.has(contactId) || contactId === currentUserId) return;

    const contactRef = doc(db, 'users', contactId);
    const unsub = onSnapshot(
      contactRef,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data() as User;
          const lastActiveTime = typeof d.lastActive === 'number' ? d.lastActive : 0;
          let lastSeenTime = typeof d.lastSeen === 'number' ? d.lastSeen : lastActiveTime;
          if (d.privacySettings?.showLastSeen === 'nobody') {
            lastSeenTime = 0;
          }

          const rawUser: User = {
            ...d,
            lastActive: lastActiveTime,
            lastSeen: lastSeenTime,
          };
          const live = computeUserLiveStatus(rawUser, Date.now());

          contactsMap.set(contactId, {
            ...rawUser,
            status: live.status,
          });
        } else {
          contactsMap.delete(contactId);
        }
        emitContacts();
      },
      (err) => {
        console.warn(`Error subscribing to contact profile ${contactId}:`, err);
      }
    );

    contactUserUnsubs.set(contactId, unsub);
  };

  // 1. Permanent Firestore /contacts collection subscription
  const contactsQuery = query(
    collection(db, 'contacts'),
    where('userId', '==', currentUserId),
    where('status', '==', 'active'),
    limit(100)
  );

  const unsubContactsColl = onSnapshot(
    contactsQuery,
    (snapshot) => {
      const currentIds = new Set<string>();
      snapshot.forEach((snap) => {
        const c = snap.data() as Contact;
        if (c.contactId && c.contactId !== currentUserId) {
          currentIds.add(c.contactId);
          activeContactIds.add(c.contactId);
          syncContactUserDoc(c.contactId);
        }
      });

      // Remove any contacts that were deleted
      for (const [id, unsub] of contactUserUnsubs.entries()) {
        if (!currentIds.has(id) && !legacyContactIds.includes(id)) {
          unsub();
          contactUserUnsubs.delete(id);
          contactsMap.delete(id);
        }
      }

      emitContacts();
    },
    (err) => {
      console.warn('Error subscribing to permanent contacts collection:', err);
    }
  );

  // In-memory set of verified backfill contacts to avoid repeat getDoc reads on every snapshot
  const verifiedBackfillIds = new Set<string>();

  // Initial one-time sync with any legacy ids passed in (no permanent onSnapshot listener on own profile)
  legacyContactIds.forEach((contactId) => {
    if (contactId && contactId !== currentUserId) {
      syncContactUserDoc(contactId);

      const permanentId = `${currentUserId}_${contactId}`;
      if (!verifiedBackfillIds.has(permanentId)) {
        verifiedBackfillIds.add(permanentId);
        getDoc(doc(db, 'contacts', permanentId)).then((permSnap) => {
          if (!permSnap.exists()) {
            setDoc(doc(db, 'contacts', permanentId), {
              id: permanentId,
              userId: currentUserId,
              contactId,
              status: 'active',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }, { merge: true }).catch(() => {});
          }
        }).catch(() => {});
      }
    }
  });

  return () => {
    unsubContactsColl();
    for (const unsub of contactUserUnsubs.values()) {
      unsub();
    }
    contactUserUnsubs.clear();
    contactsMap.clear();
  };
}
