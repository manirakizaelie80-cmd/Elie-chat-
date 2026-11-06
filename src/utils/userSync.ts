import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { User } from '../types';

export async function saveUserRealtime(user: User, peerId?: string): Promise<void> {
  const path = `users/${user.id}`;
  try {
    const isOffline = user.status === 'offline';
    const data: Record<string, any> = {
      id: user.id,
      name: user.name,
      status: user.status || 'online',
      lastActive: Date.now(),
    };

    if (isOffline) {
      data.lastSeen = Date.now();
    } else if (user.lastSeen) {
      data.lastSeen = user.lastSeen;
    }

    if (user.avatar) data.avatar = user.avatar;
    if (user.email) data.email = user.email;
    if (user.username) data.username = user.username;
    if (user.customStatus !== undefined) data.customStatus = user.customStatus;
    if (peerId) data.peerId = peerId;
    if (Array.isArray(user.contacts) && user.contacts.length > 0) data.contacts = user.contacts;
    if (Array.isArray(user.blockedUserIds) && user.blockedUserIds.length > 0) data.blockedUserIds = user.blockedUserIds;
    if (user.privacySettings) data.privacySettings = user.privacySettings;
    if (user.readReceiptsEnabled !== undefined) data.readReceiptsEnabled = user.readReceiptsEnabled;
    if (user.createdAt) data.createdAt = user.createdAt;
    if (user.location) {
      data.location = {
        city: user.location.city,
        country: user.location.country,
        flag: user.location.flag,
        timezone: user.location.timezone,
        lat: user.location.lat,
        lng: user.location.lng,
      };
    }

    await setDoc(doc(db, 'users', user.id), data, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Computes a user's live presence status automatically based on their lastActive timestamp.
 * - < 35s ago: 'online' (active presence)
 * - 35s - 90s ago: 'away' (idle or tab backgrounded)
 * - >= 90s ago: 'offline' (timed out or disconnected)
 * Respects 'in-call' state and user privacy preferences.
 */
export function computeUserLiveStatus(
  user: User,
  now: number = Date.now()
): { status: User['status']; isOnline: boolean } {
  // Check privacy settings
  if (user.privacySettings?.showOnlineStatus === 'nobody') {
    return { status: 'offline', isOnline: false };
  }

  // If currently in a WebRTC call, preserve in-call presence
  if (user.status === 'in-call') {
    return { status: 'in-call', isOnline: true };
  }

  // Explicit user manual status
  if (user.status === 'offline') {
    return { status: 'offline', isOnline: false };
  }

  const lastActive = typeof user.lastActive === 'number' ? user.lastActive : (typeof user.lastSeen === 'number' ? user.lastSeen : 0);
  if (!lastActive) {
    return { status: 'offline', isOnline: false };
  }

  const diffMs = now - lastActive;

  // Active within 100 seconds (relaxed 65s heartbeat saves substantial daily write quota)
  if (diffMs < 100000) {
    if (user.status === 'busy') return { status: 'busy', isOnline: true };
    if (user.status === 'away') return { status: 'away', isOnline: true };
    return { status: 'online', isOnline: true };
  }

  // Idle / backgrounded: between 100s and 220s
  if (diffMs < 220000) {
    return { status: 'away', isOnline: true };
  }

  // Inactive / disconnected: past 220 seconds
  return { status: 'offline', isOnline: false };
}

export function subscribeUsersRealtime(
  onUsersUpdate: (users: User[]) => void
): () => void {
  const path = 'users';
  try {
    const usersCol = collection(db, path);
    const unsubscribe = onSnapshot(
      usersCol,
      (snapshot) => {
        const usersList: User[] = [];
        const now = Date.now();

        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d && d.id && d.name) {
            const rawUser: User = {
              id: d.id,
              name: d.name,
              username: d.username,
              avatar: d.avatar || '',
              email: d.email,
              status: d.status || 'online',
              customStatus: d.customStatus,
              location: d.location,
              peerId: d.peerId,
              contacts: Array.isArray(d.contacts) ? d.contacts : [],
              blockedUserIds: Array.isArray(d.blockedUserIds) ? d.blockedUserIds : [],
              privacySettings: d.privacySettings,
              readReceiptsEnabled: d.readReceiptsEnabled,
              createdAt: d.createdAt,
              lastActive: typeof d.lastActive === 'number' ? d.lastActive : 0,
              lastSeen: typeof d.lastSeen === 'number' ? d.lastSeen : (typeof d.lastActive === 'number' ? d.lastActive : 0),
            };

            const live = computeUserLiveStatus(rawUser, now);

            usersList.push({
              ...rawUser,
              status: live.status,
            });
          }
        });

        onUsersUpdate(usersList);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
    return unsubscribe;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return () => {};
  }
}

/**
 * Automatically counts unique online users using live presence verification.
 */
export function countOnlineUsers(users: User[], now: number = Date.now()): number {
  const onlineUserIds = new Set<string>();
  for (const u of users) {
    const live = computeUserLiveStatus(u, now);
    if (live.isOnline) {
      onlineUserIds.add(u.id);
    }
  }
  return onlineUserIds.size;
}

/**
 * Automatically formats dynamic last-seen timestamps that update reactively with live time.
 */
export function formatLastSeen(lastActiveOrSeen?: number, now: number = Date.now()): string {
  if (!lastActiveOrSeen) return 'Offline';
  const diffSec = Math.max(0, Math.floor((now - lastActiveOrSeen) / 1000));
  if (diffSec < 40) return 'Active just now';
  if (diffSec < 75) return 'Active now';
  if (diffSec < 120) return 'Last seen just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Last seen ${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Last seen ${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Last seen yesterday';
  if (diffDays < 7) return `Last seen ${diffDays}d ago`;
  return new Date(lastActiveOrSeen).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Formats short relative timestamps for chat previews and message headers.
 */
export function formatRelativeTime(timestamp?: number, now: number = Date.now()): string {
  if (!timestamp) return '';
  const diff = Math.max(0, now - timestamp);
  if (diff < 30000) return 'Just now';
  if (diff < 60000) return '1m';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  if (diff < 172800000) return '1d';
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
}
