import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  limit, 
  getDocs,
  writeBatch 
} from 'firebase/firestore';
import { db } from '../firebase';
import { InAppNotification } from '../types';

export async function createInAppNotification(params: {
  recipientId: string;
  type: InAppNotification['type'];
  title: string;
  message: string;
  targetId?: string;
  isGroup?: boolean;
  senderId?: string;
  senderName?: string;
}): Promise<void> {
  const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const notifRef = doc(db, 'notifications', notifId);

  const notif: InAppNotification = {
    id: notifId,
    recipientId: params.recipientId,
    type: params.type,
    title: params.title,
    message: params.message,
    targetId: params.targetId,
    isGroup: params.isGroup,
    senderId: params.senderId,
    senderName: params.senderName,
    read: false,
    createdAt: Date.now(),
  };

  await setDoc(notifRef, notif);
}

export function subscribeUserNotifications(
  userId: string,
  callback: (notifications: InAppNotification[]) => void
): () => void {
  const q = query(
    collection(db, 'notifications'),
    where('recipientId', '==', userId),
    limit(50)
  );

  return onSnapshot(q, (snapshot) => {
    const list: InAppNotification[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as InAppNotification);
    });
    list.sort((a, b) => b.createdAt - a.createdAt);
    callback(list);
  }, (err) => {
    console.error('Error fetching notifications:', err);
  });
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const ref = doc(db, 'notifications', notificationId);
  await updateDoc(ref, {
    read: true,
  });
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const q = query(
    collection(db, 'notifications'),
    where('recipientId', '==', userId),
    where('read', '==', false)
  );

  const snap = await getDocs(q);
  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.update(d.ref, { read: true });
  });
  await batch.commit();
}
