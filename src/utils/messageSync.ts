import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  limit, 
  arrayUnion 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Message } from '../types';

export function getConversationId(currentUserId: string, targetId: string, isGroup: boolean): string {
  if (isGroup) {
    return `room__${targetId}`;
  }
  return [currentUserId, targetId].sort().join('__');
}

export async function saveMessageRealtime(message: Message): Promise<void> {
  const path = `messages/${message.id}`;
  try {
    const data: Record<string, any> = {
      id: message.id,
      conversationId: message.conversationId,
      targetId: message.targetId,
      isGroup: Boolean(message.isGroup),
      senderId: message.senderId,
      senderName: message.senderName,
      timestamp: message.timestamp || Date.now(),
    };

    if (message.senderAvatar) data.senderAvatar = message.senderAvatar;
    if (message.text !== undefined) data.text = message.text;
    if (message.mediaUrl) data.mediaUrl = message.mediaUrl;
    if (message.mediaType) data.mediaType = message.mediaType;
    if (message.voiceAudio) data.voiceAudio = message.voiceAudio;
    if (message.voiceDuration !== undefined) data.voiceDuration = message.voiceDuration;
    if (message.replyTo) data.replyTo = message.replyTo;
    if (message.reactions) data.reactions = message.reactions;
    if (message.status) data.status = message.status;
    if (message.readBy) data.readBy = message.readBy;

    await setDoc(doc(db, 'messages', message.id), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeConversationMessages(
  conversationId: string,
  onMessagesUpdate: (messages: Message[]) => void
): () => void {
  const path = 'messages';
  try {
    const q = query(
      collection(db, path),
      where('conversationId', '==', conversationId),
      limit(250)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Message[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d && d.id && d.conversationId) {
            list.push({
              id: d.id,
              conversationId: d.conversationId,
              targetId: d.targetId || '',
              isGroup: Boolean(d.isGroup),
              senderId: d.senderId,
              senderName: d.senderName,
              senderAvatar: d.senderAvatar || '',
              text: d.text || '',
              mediaUrl: d.mediaUrl,
              mediaType: d.mediaType,
              voiceAudio: d.voiceAudio,
              voiceDuration: d.voiceDuration,
              reactions: d.reactions || {},
              replyTo: d.replyTo,
              status: d.status || 'delivered',
              readBy: Array.isArray(d.readBy) ? d.readBy : [],
              timestamp: typeof d.timestamp === 'number' ? d.timestamp : Date.now(),
            });
          }
        });

        // In-memory chronological sort (safely avoids complex Firestore composite index requirements)
        list.sort((a, b) => a.timestamp - b.timestamp);
        onMessagesUpdate(list);
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

export function subscribeAllMessagesRealtime(
  onMessagesUpdate: (messages: Message[]) => void
): () => void {
  const path = 'messages';
  try {
    const q = query(
      collection(db, path),
      limit(300)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Message[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d && d.id) {
            list.push({
              id: d.id,
              conversationId: d.conversationId || '',
              targetId: d.targetId || '',
              isGroup: Boolean(d.isGroup),
              senderId: d.senderId,
              senderName: d.senderName,
              senderAvatar: d.senderAvatar || '',
              text: d.text || '',
              mediaUrl: d.mediaUrl,
              mediaType: d.mediaType,
              voiceAudio: d.voiceAudio,
              voiceDuration: d.voiceDuration,
              reactions: d.reactions || {},
              replyTo: d.replyTo,
              status: d.status || 'delivered',
              readBy: Array.isArray(d.readBy) ? d.readBy : [],
              timestamp: typeof d.timestamp === 'number' ? d.timestamp : Date.now(),
            });
          }
        });

        list.sort((a, b) => a.timestamp - b.timestamp);
        onMessagesUpdate(list);
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

export async function updateMessageReactionsRealtime(
  messageId: string, 
  reactions: Record<string, string[]>
): Promise<void> {
  const path = `messages/${messageId}`;
  try {
    await updateDoc(doc(db, 'messages', messageId), {
      reactions,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function markMessagesAsReadRealtime(
  messages: Message[],
  currentUserId: string
): Promise<void> {
  const unreadMessages = messages.filter(
    (m) => m.senderId !== currentUserId && (!m.readBy || !m.readBy.includes(currentUserId))
  );

  for (const m of unreadMessages) {
    try {
      await updateDoc(doc(db, 'messages', m.id), {
        status: 'read',
        readBy: arrayUnion(currentUserId),
      });
    } catch (e) {
      // ignore concurrent read receipt update
    }
  }
}

export async function deleteMessageRealtime(messageId: string): Promise<void> {
  const path = `messages/${messageId}`;
  try {
    await deleteDoc(doc(db, 'messages', messageId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
