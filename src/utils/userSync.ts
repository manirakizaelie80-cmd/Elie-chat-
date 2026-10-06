import { collection, doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { User } from '../types';

export async function saveUserRealtime(user: User, peerId?: string): Promise<void> {
  const path = `users/${user.id}`;
  try {
    const data: Record<string, any> = {
      id: user.id,
      name: user.name,
      status: user.status || 'online',
      lastActive: Date.now(),
    };

    if (user.avatar) data.avatar = user.avatar;
    if (user.customStatus) data.customStatus = user.customStatus;
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
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d && d.id && d.name) {
            usersList.push({
              id: d.id,
              name: d.name,
              avatar: d.avatar || '',
              status: d.status || 'online',
              customStatus: d.customStatus,
              location: d.location,
              lastActive: typeof d.lastActive === 'number' ? d.lastActive : Date.now(),
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
