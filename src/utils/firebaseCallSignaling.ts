import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  onSnapshot, 
  addDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { CallSession, User } from '../types';

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

export interface ActiveWebRTCSession {
  callId: string;
  peerConnection: RTCPeerConnection;
  cleanup: () => void;
}

export function subscribeIncomingCalls(
  currentUserId: string,
  onIncomingCall: (call: CallSession) => void
): () => void {
  const path = 'calls';
  try {
    const q = query(
      collection(db, path),
      where('receiverId', '==', currentUserId),
      where('status', '==', 'calling')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            const createdAt = typeof data.createdAt === 'number' ? data.createdAt : 0;
            // Ignore stale calls initiated more than 60 seconds ago
            if (Date.now() - createdAt < 60000) {
              onIncomingCall({
                id: data.id || change.doc.id,
                callerId: data.callerId,
                callerName: data.callerName,
                callerAvatar: data.callerAvatar,
                receiverId: data.receiverId,
                isGroup: Boolean(data.isGroup),
                type: data.type || 'audio',
                status: data.status,
                offer: data.offer,
                answer: data.answer,
                createdAt: data.createdAt,
              });
            }
          }
        });
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

export async function startOutgoingCall(params: {
  callId: string;
  caller: User;
  receiverId: string;
  isGroup: boolean;
  type: 'audio' | 'video';
  localStream: MediaStream;
  onRemoteStream: (stream: MediaStream) => void;
  onCallStateChange: (status: CallSession['status']) => void;
  onCallEnded: () => void;
}): Promise<ActiveWebRTCSession> {
  const {
    callId,
    caller,
    receiverId,
    isGroup,
    type,
    localStream,
    onRemoteStream,
    onCallStateChange,
    onCallEnded,
  } = params;

  const pc = new RTCPeerConnection({
    iceServers: ICE_SERVERS,
  });

  const remoteStream = new MediaStream();

  // Add all local audio & video tracks to PeerConnection
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  // Handle incoming remote tracks
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
    onRemoteStream(remoteStream);
  };

  const callDocRef = doc(db, 'calls', callId);
  const callerCandidatesCol = collection(db, 'calls', callId, 'callerCandidates');
  const receiverCandidatesCol = collection(db, 'calls', callId, 'receiverCandidates');

  // Push local ICE candidates to Firestore callerCandidates collection
  pc.onicecandidate = async (event) => {
    if (event.candidate) {
      try {
        await addDoc(callerCandidatesCol, {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          createdAt: Date.now(),
        });
      } catch (e) {
        // ignore transient candidate error
      }
    }
  };

  // Generate SDP offer
  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const callData: Record<string, any> = {
    id: callId,
    callerId: caller.id,
    callerName: caller.name,
    callerAvatar: caller.avatar || '',
    receiverId,
    isGroup,
    type,
    status: 'calling',
    offer: {
      type: offerDescription.type,
      sdp: offerDescription.sdp,
    },
    createdAt: Date.now(),
  };

  await setDoc(callDocRef, callData);

  let hasSetRemoteAnswer = false;

  // Listen for call document status changes (e.g. accepted, rejected, ended)
  const unsubscribeCall = onSnapshot(callDocRef, async (snapshot) => {
    const data = snapshot.data();
    if (!data) return;

    if (data.status === 'accepted' && data.answer && !hasSetRemoteAnswer) {
      hasSetRemoteAnswer = true;
      const answerDescription = new RTCSessionDescription(data.answer);
      if (pc.signalingState !== 'closed') {
        await pc.setRemoteDescription(answerDescription);
        onCallStateChange('accepted');
      }
    } else if (data.status === 'rejected') {
      onCallStateChange('rejected');
      cleanup();
      onCallEnded();
    } else if (data.status === 'ended') {
      onCallStateChange('ended');
      cleanup();
      onCallEnded();
    }
  });

  // Listen for receiver's ICE candidates
  const unsubscribeCandidates = onSnapshot(receiverCandidatesCol, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const data = change.doc.data();
        if (data && data.candidate && pc.signalingState !== 'closed') {
          const candidate = new RTCIceCandidate({
            candidate: data.candidate,
            sdpMid: data.sdpMid,
            sdpMLineIndex: data.sdpMLineIndex,
          });
          pc.addIceCandidate(candidate).catch(() => {});
        }
      }
    });
  });

  const cleanup = () => {
    unsubscribeCall();
    unsubscribeCandidates();
    pc.ontrack = null;
    pc.onicecandidate = null;
    if (pc.signalingState !== 'closed') {
      pc.close();
    }
  };

  return {
    callId,
    peerConnection: pc,
    cleanup,
  };
}

export async function answerIncomingCall(params: {
  callId: string;
  answeringUser: User;
  localStream: MediaStream;
  onRemoteStream: (stream: MediaStream) => void;
  onCallStateChange: (status: CallSession['status']) => void;
  onCallEnded: () => void;
}): Promise<ActiveWebRTCSession> {
  const {
    callId,
    answeringUser,
    localStream,
    onRemoteStream,
    onCallStateChange,
    onCallEnded,
  } = params;

  const pc = new RTCPeerConnection({
    iceServers: ICE_SERVERS,
  });

  const remoteStream = new MediaStream();

  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
    onRemoteStream(remoteStream);
  };

  const callDocRef = doc(db, 'calls', callId);
  const callerCandidatesCol = collection(db, 'calls', callId, 'callerCandidates');
  const receiverCandidatesCol = collection(db, 'calls', callId, 'receiverCandidates');

  pc.onicecandidate = async (event) => {
    if (event.candidate) {
      try {
        await addDoc(receiverCandidatesCol, {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          createdAt: Date.now(),
        });
      } catch (e) {
        // ignore
      }
    }
  };

  const callSnap = await getDoc(callDocRef);
  const callData = callSnap.data();

  if (!callData || !callData.offer) {
    throw new Error('Call session or SDP offer not found');
  }

  await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  await updateDoc(callDocRef, {
    status: 'accepted',
    answer: {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    },
  });

  onCallStateChange('accepted');

  // Listen for caller candidates
  const unsubscribeCandidates = onSnapshot(callerCandidatesCol, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const data = change.doc.data();
        if (data && data.candidate && pc.signalingState !== 'closed') {
          const candidate = new RTCIceCandidate({
            candidate: data.candidate,
            sdpMid: data.sdpMid,
            sdpMLineIndex: data.sdpMLineIndex,
          });
          pc.addIceCandidate(candidate).catch(() => {});
        }
      }
    });
  });

  // Listen for call termination
  const unsubscribeCall = onSnapshot(callDocRef, (snapshot) => {
    const data = snapshot.data();
    if (!data || data.status === 'ended') {
      onCallStateChange('ended');
      cleanup();
      onCallEnded();
    }
  });

  const cleanup = () => {
    unsubscribeCall();
    unsubscribeCandidates();
    pc.ontrack = null;
    pc.onicecandidate = null;
    if (pc.signalingState !== 'closed') {
      pc.close();
    }
  };

  return {
    callId,
    peerConnection: pc,
    cleanup,
  };
}

export async function rejectCallSession(callId: string): Promise<void> {
  const callDocRef = doc(db, 'calls', callId);
  try {
    await updateDoc(callDocRef, {
      status: 'rejected',
      endedAt: Date.now(),
    });
  } catch (error) {
    // If not exists or already ended, silently ignore
  }
}

export async function endCallSession(callId: string): Promise<void> {
  const callDocRef = doc(db, 'calls', callId);
  try {
    await updateDoc(callDocRef, {
      status: 'ended',
      endedAt: Date.now(),
    });
  } catch (error) {
    // Silently ignore if already closed
  }
}
