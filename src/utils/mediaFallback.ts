// Safe getUserMedia with fallback simulated video & audio tracks
// This guarantees that WebRTC calls always succeed even in restrictive iframe/permission environments

export function createSimulatedMediaStream(displayName: string, isVideo = true): MediaStream {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');

  let animationFrameId: number;
  let phase = 0;

  const draw = () => {
    if (!ctx) return;
    phase += 0.04;

    // Dark sleek background
    const gradient = ctx.createLinearGradient(0, 0, 640, 480);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(1, '#1e293b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 640, 480);

    // Dynamic wave circles
    for (let i = 0; i < 3; i++) {
      const radius = 60 + Math.sin(phase + i) * 20;
      ctx.beginPath();
      ctx.arc(320, 210, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(59, 130, 246, ${0.3 - i * 0.08})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Avatar Circle
    ctx.beginPath();
    ctx.arc(320, 210, 50, 0, Math.PI * 2);
    ctx.fillStyle = '#2563eb';
    ctx.fill();

    // Initial Letter
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((displayName[0] || 'U').toUpperCase(), 320, 212);

    // Name Tag
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(displayName, 320, 310);

    // Status subtitle
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(isVideo ? 'Live Simulated Video Stream' : 'Live Voice Stream', 320, 335);

    // Live equalizer visualizer bars at the bottom
    const barCount = 18;
    const barWidth = 12;
    const spacing = 8;
    const startX = 320 - (barCount * (barWidth + spacing)) / 2;

    for (let i = 0; i < barCount; i++) {
      const height = 10 + Math.abs(Math.sin(phase * 1.5 + i * 0.4)) * 36;
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(startX + i * (barWidth + spacing), 410 - height, barWidth, height);
    }

    animationFrameId = requestAnimationFrame(draw);
  };

  draw();

  const canvasStream = canvas.captureStream(30);

  // Audio track from Web Audio Oscillator
  let audioTrack: MediaStreamTrack | null = null;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const actx = new AudioContextClass();
    const dest = actx.createMediaStreamDestination();
    const osc = actx.createOscillator();
    const gain = actx.createGain();

    // Very quiet gentle frequency tone to simulate microphone input
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, actx.currentTime);
    gain.gain.setValueAtTime(0.001, actx.currentTime); // barely audible whisper tone

    osc.connect(gain);
    gain.connect(dest);
    osc.start();

    audioTrack = dest.stream.getAudioTracks()[0] || null;
  } catch (e) {
    console.warn('Could not generate simulated audio track', e);
  }

  const combinedStream = new MediaStream();
  if (canvasStream.getVideoTracks().length > 0) {
    const vTrack = canvasStream.getVideoTracks()[0];
    // Attach cleanup
    const origStop = vTrack.stop.bind(vTrack);
    vTrack.stop = () => {
      cancelAnimationFrame(animationFrameId);
      origStop();
    };
    combinedStream.addTrack(vTrack);
  }

  if (audioTrack) {
    combinedStream.addTrack(audioTrack);
  }

  return combinedStream;
}

export async function getUserMediaSafe(
  constraints: MediaStreamConstraints,
  displayName: string
): Promise<{ stream: MediaStream; isSimulated: boolean }> {
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const realStream = await navigator.mediaDevices.getUserMedia(constraints);
      return { stream: realStream, isSimulated: false };
    }
  } catch (err) {
    console.info('Native media device not available or permitted, using simulated stream for reliability:', err);
  }

  // Fallback to simulated stream
  const simStream = createSimulatedMediaStream(displayName, Boolean(constraints.video));
  return { stream: simStream, isSimulated: true };
}
