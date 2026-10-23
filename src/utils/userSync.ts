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
    if (user.customStatus !== undefined) data.customStatus = user.customStatus;
    if (peerId) data.peerId = peerId;
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
            const lastActiveTime = typeof d.lastActive === 'number' ? d.lastActive : 0;
            const isFresh = now - lastActiveTime < 45000; // Heartbeat window is 20s, threshold 45s

            let computedStatus: User['status'] = 'offline';
            if (isFresh) {
              if (d.status === 'in-call') computedStatus = 'in-call';
              else if (d.status === 'busy') computedStatus = 'busy';
              else if (d.status === 'away') computedStatus = 'away';
              else computedStatus = 'online';
            } else {
              computedStatus = 'offline';
            }

            usersList.push({
              id: d.id,
              name: d.name,
              avatar: d.avatar || '',
              email: d.email,
              status: computedStatus,
              customStatus: d.customStatus,
              location: d.location,
              peerId: d.peerId,
              lastActive: lastActiveTime,
              lastSeen: typeof d.lastSeen === 'number' ? d.lastSeen : lastActiveTime,
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

export function countOnlineUsers(users: User[]): number {
  // Deduplicate by user.id so multi-tab sessions of the same account are only counted once
  const onlineUserIds = new Set<string>();
  for (const u of users) {
    if (u.status === 'online' || u.status === 'in-call' || u.status === 'busy') {
      onlineUserIds.add(u.id);
    }
  }
  return onlineUserIds.size;
}

export function formatLastSeen(lastActiveOrSeen?: number): string {
  if (!lastActiveOrSeen) return 'Offline';
  const diffSec = Math.floor((Date.now() - lastActiveOrSeen) / 1000);
  if (diffSec < 45) return 'Active now';
  if (diffSec < 60) return 'Last seen just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Last seen ${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Last seen ${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Last seen yesterday';
  return `Last seen ${diffDays}d ago`;
}
