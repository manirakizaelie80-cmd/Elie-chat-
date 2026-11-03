import { collection, doc, setDoc, deleteDoc, onSnapshot, query, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Room } from '../types';

export async function saveRoomRealtime(room: Room): Promise<void> {
  const path = `rooms/${room.id}`;
  try {
    const data: Record<string, any> = {
      id: room.id,
      name: room.name,
      type: room.type,
      createdById: room.createdById,
      createdAt: room.createdAt || Date.now(),
    };

    if (room.description) data.description = room.description;
    if (room.createdByName) data.createdByName = room.createdByName;
    if (room.category) data.category = room.category;
    if (room.icon) data.icon = room.icon;
    if (room.isCustomGroup !== undefined) data.isCustomGroup = room.isCustomGroup;
    if (room.isPrivate !== undefined) data.isPrivate = room.isPrivate;
    if (room.requiresApproval !== undefined) data.requiresApproval = room.requiresApproval;
    if (room.memberIds && Array.isArray(room.memberIds)) data.memberIds = room.memberIds;
    if (room.adminIds && Array.isArray(room.adminIds)) data.adminIds = room.adminIds;
    if (room.activeCall) data.activeCall = room.activeCall;

    await setDoc(doc(db, 'rooms', room.id), data, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteRoomRealtime(roomId: string): Promise<void> {
  const path = `rooms/${roomId}`;
  try {
    await deleteDoc(doc(db, 'rooms', roomId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeRoomsRealtime(
  onRoomsUpdate: (rooms: Room[]) => void
): () => void {
  const path = 'rooms';
  try {
    const roomsQuery = query(collection(db, path), limit(60));
    const unsubscribe = onSnapshot(
      roomsQuery,
      (snapshot) => {
        const roomsList: Room[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d && d.id && d.name && d.type) {
            roomsList.push({
              id: d.id,
              name: d.name,
              description: d.description || '',
              type: d.type as 'text' | 'voice-video',
              createdById: d.createdById || 'system',
              createdByName: d.createdByName,
              category: d.category,
              icon: d.icon,
              isCustomGroup: Boolean(d.isCustomGroup),
              isPrivate: Boolean(d.isPrivate),
              requiresApproval: Boolean(d.requiresApproval),
              memberIds: Array.isArray(d.memberIds) ? d.memberIds : [],
              adminIds: Array.isArray(d.adminIds) ? d.adminIds : [],
              createdAt: typeof d.createdAt === 'number' ? d.createdAt : Date.now(),
              activeCall: d.activeCall,
            });
          }
        });
        onRoomsUpdate(roomsList);
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
