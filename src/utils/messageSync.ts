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
      status: message.status || 'sent',
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
    if (message.readBy) data.readBy = message.readBy;
    if (message.readAt) data.readAt = message.readAt;

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
              status: d.status || 'sent',
              readBy: Array.isArray(d.readBy) ? d.readBy : [],
              readAt: typeof d.readAt === 'number' ? d.readAt : undefined,
              timestamp: typeof d.timestamp === 'number' ? d.timestamp : Date.now(),
            });
          }
        });

        // Chronological sort
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
              status: d.status || 'sent',
              readBy: Array.isArray(d.readBy) ? d.readBy : [],
              readAt: typeof d.readAt === 'number' ? d.readAt : undefined,
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

// Mark messages as delivered when recipient's client synchronizes them
export async function markMessagesAsDeliveredRealtime(
  messages: Message[],
  currentUserId: string
): Promise<void> {
  const undelivered = messages.filter(
    (m) => m.senderId !== currentUserId && m.status === 'sent'
  );

  for (const m of undelivered) {
    try {
      await updateDoc(doc(db, 'messages', m.id), {
        status: 'delivered',
      });
    } catch {
      // ignore concurrent update
    }
  }
}

// Mark messages as read when recipient opens and views the conversation
export async function markMessagesAsReadRealtime(
  messages: Message[],
  currentUserId: string,
  readReceiptsEnabled: boolean = true
): Promise<void> {
  const unreadMessages = messages.filter(
    (m) => m.senderId !== currentUserId && (!m.readBy || !m.readBy.includes(currentUserId))
  );

  for (const m of unreadMessages) {
    try {
      const updates: Record<string, any> = {
        readBy: arrayUnion(currentUserId),
      };

      if (readReceiptsEnabled) {
        updates.status = 'read';
        updates.readAt = Date.now();
      } else if (m.status === 'sent') {
        updates.status = 'delivered';
      }

      await updateDoc(doc(db, 'messages', m.id), updates);
    } catch {
      // ignore concurrent update
    }
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

export async function deleteMessageRealtime(messageId: string): Promise<void> {
  const path = `messages/${messageId}`;
  try {
    await deleteDoc(doc(db, 'messages', messageId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
