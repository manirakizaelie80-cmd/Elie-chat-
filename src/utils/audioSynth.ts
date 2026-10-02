// Web Audio API Synthesizer for high-fidelity ringtones & alerts
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

let activeRingtoneTimer: any = null;

export function playRingtone() {
  stopRingtone();
  const ctx = getAudioContext();

  const playChimeBurst = () => {
    try {
      const now = ctx.currentTime;
      // Dual-tone US/UK style telephone ring (440Hz + 480Hz)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(440, now);
      osc2.frequency.setValueAtTime(480, now);

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.12, now + 0.08);
      gainNode.gain.setValueAtTime(0.12, now + 1.2);
      gainNode.gain.linearRampToValueAtTime(0, now + 1.35);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.35);
      osc2.stop(now + 1.35);
    } catch (e) {
      console.warn('Audio ringtone play error', e);
    }
  };

  playChimeBurst();
  activeRingtoneTimer = setInterval(playChimeBurst, 3000);
}

export function stopRingtone() {
  if (activeRingtoneTimer) {
    clearInterval(activeRingtoneTimer);
    activeRingtoneTimer = null;
  }
}

export function playCallingRing() {
  const ctx = getAudioContext();
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(425, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
    gain.gain.setValueAtTime(0.08, now + 0.8);
    gain.gain.linearRampToValueAtTime(0, now + 0.9);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.9);
  } catch (e) {
    console.warn('Calling ring error', e);
  }
}

export function playMessageNotification() {
  const ctx = getAudioContext();
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  } catch (e) {
    console.warn('Notification sound error', e);
  }
}

export function playCallConnected() {
  const ctx = getAudioContext();
  try {
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.09;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.1, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.25);
    });
  } catch (e) {
    console.warn('Call connected sound error', e);
  }
}

export function playCallEnded() {
  const ctx = getAudioContext();
  try {
    const now = ctx.currentTime;
    [659.25, 523.25, 392.00].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.09, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.28);
    });
  } catch (e) {
    console.warn('Call ended sound error', e);
  }
}
