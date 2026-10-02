// WebRTC Mesh Manager for 1-on-1 and Group Voice/Video Calls

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export type SignalHandler = (targetPeerId: string, signalData: any) => void;
export type StreamHandler = (peerId: string, stream: MediaStream) => void;
export type PeerStatusHandler = (peerId: string, status: { isSpeaking?: boolean }) => void;

export class WebRTCManager {
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private sendSignal: SignalHandler;
  private onRemoteStream: StreamHandler;
  private onRemoteLeave: (peerId: string) => void;
  private onPeerSpeaking: PeerStatusHandler;
  private audioAnalyzers: Map<string, { analyser: AnalyserNode; intervalId: any }> = new Map();
  private localAudioCtx: AudioContext | null = null;

  constructor(options: {
    sendSignal: SignalHandler;
    onRemoteStream: StreamHandler;
    onRemoteLeave: (peerId: string) => void;
    onPeerSpeaking: PeerStatusHandler;
  }) {
    this.sendSignal = options.sendSignal;
    this.onRemoteStream = options.onRemoteStream;
    this.onRemoteLeave = options.onRemoteLeave;
    this.onPeerSpeaking = options.onPeerSpeaking;
  }

  setLocalStream(stream: MediaStream) {
    this.localStream = stream;
    // Attach tracks to all existing peer connections
    for (const [peerId, pc] of this.peerConnections.entries()) {
      const senders = pc.getSenders();
      for (const track of stream.getTracks()) {
        const existingSender = senders.find((s) => s.track?.kind === track.kind);
        if (existingSender) {
          existingSender.replaceTrack(track);
        } else {
          pc.addTrack(track, stream);
        }
      }
    }
    this.monitorSpeaking('local', stream);
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStreams(): Map<string, MediaStream> {
    return this.remoteStreams;
  }

  // Create or get peer connection
  getOrCreatePeerConnection(peerId: string, isInitiator: boolean): RTCPeerConnection {
    let pc = this.peerConnections.get(peerId);
    if (pc) return pc;

    pc = new RTCPeerConnection(ICE_SERVERS);
    this.peerConnections.set(peerId, pc);

    // Add local tracks
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(peerId, { candidate: event.candidate.toJSON() });
      }
    };

    pc.ontrack = (event) => {
      let stream = this.remoteStreams.get(peerId);
      if (!stream) {
        stream = new MediaStream();
        this.remoteStreams.set(peerId, stream);
      }
      stream.addTrack(event.track);
      this.onRemoteStream(peerId, stream);
      this.monitorSpeaking(peerId, stream);
    };

    pc.onconnectionstatechange = () => {
      if (pc?.connectionState === 'disconnected' || pc?.connectionState === 'failed' || pc?.connectionState === 'closed') {
        this.removePeer(peerId);
      }
    };

    if (isInitiator) {
      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          this.sendSignal(peerId, { sdp: pc.localDescription });
        } catch (e) {
          console.error('Error creating offer for peer', peerId, e);
        }
      };
    }

    return pc;
  }

  async initiateConnectionTo(peerId: string) {
    const pc = this.getOrCreatePeerConnection(peerId, true);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.sendSignal(peerId, { sdp: pc.localDescription });
    } catch (err) {
      console.error('Failed to initiate connection to peer', peerId, err);
    }
  }

  async handleSignal(peerId: string, signalData: any) {
    if (signalData.sdp) {
      const sdp = new RTCSessionDescription(signalData.sdp);
      let pc = this.peerConnections.get(peerId);

      if (sdp.type === 'offer') {
        if (!pc) {
          pc = this.getOrCreatePeerConnection(peerId, false);
        }
        await pc.setRemoteDescription(sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.sendSignal(peerId, { sdp: pc.localDescription });
      } else if (sdp.type === 'answer') {
        if (pc) {
          await pc.setRemoteDescription(sdp);
        }
      }
    } else if (signalData.candidate) {
      const pc = this.peerConnections.get(peerId);
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
        } catch (e) {
          console.warn('Error adding ICE candidate', e);
        }
      }
    }
  }

  setAudioMuted(muted: boolean) {
    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        track.enabled = !muted;
      }
    }
  }

  setVideoDisabled(disabled: boolean) {
    if (this.localStream) {
      for (const track of this.localStream.getVideoTracks()) {
        track.enabled = !disabled;
      }
    }
  }

  async startScreenShare(): Promise<MediaStream | null> {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        this.screenStream = screenStream;

        const screenTrack = screenStream.getVideoTracks()[0];
        if (screenTrack) {
          // Replace video track for all peers
          for (const pc of this.peerConnections.values()) {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(screenTrack);
            }
          }

          screenTrack.onended = () => {
            this.stopScreenShare();
          };
        }
        return screenStream;
      }
    } catch (err) {
      console.warn('Screen share cancelled or not available', err);
    }
    return null;
  }

  stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }

    // Revert back to camera track
    if (this.localStream) {
      const camTrack = this.localStream.getVideoTracks()[0] || null;
      for (const pc of this.peerConnections.values()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender && camTrack) {
          sender.replaceTrack(camTrack);
        }
      }
    }
  }

  private monitorSpeaking(peerId: string, stream: MediaStream) {
    try {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;

      if (!this.localAudioCtx) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.localAudioCtx = new AudioContextClass();
      }

      if (this.localAudioCtx.state === 'suspended') {
        this.localAudioCtx.resume();
      }

      const source = this.localAudioCtx.createMediaStreamSource(stream);
      const analyser = this.localAudioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let wasSpeaking = false;

      const intervalId = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const isSpeaking = avg > 25; // threshold
        if (isSpeaking !== wasSpeaking) {
          wasSpeaking = isSpeaking;
          this.onPeerSpeaking(peerId, { isSpeaking });
        }
      }, 200);

      this.audioAnalyzers.set(peerId, { analyser, intervalId });
    } catch (e) {
      // AudioContext or stream issue, skip
    }
  }

  removePeer(peerId: string) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
    const stream = this.remoteStreams.get(peerId);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      this.remoteStreams.delete(peerId);
    }
    const monitor = this.audioAnalyzers.get(peerId);
    if (monitor) {
      clearInterval(monitor.intervalId);
      this.audioAnalyzers.delete(peerId);
    }
    this.onRemoteLeave(peerId);
  }

  destroy() {
    this.stopScreenShare();

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    for (const [peerId] of this.peerConnections) {
      this.removePeer(peerId);
    }

    for (const [, monitor] of this.audioAnalyzers) {
      clearInterval(monitor.intervalId);
    }
    this.audioAnalyzers.clear();

    if (this.localAudioCtx && this.localAudioCtx.state !== 'closed') {
      this.localAudioCtx.close();
      this.localAudioCtx = null;
    }
  }
}
