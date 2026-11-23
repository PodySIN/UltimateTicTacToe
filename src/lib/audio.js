let audioContext;
let enabled = true;

export function setSoundEnabled(v) {
  enabled = !!v;
  try {
    localStorage.setItem('neon_sound', enabled ? '1' : '0');
  } catch {}
}

export function isSoundEnabled() {
  try {
    const v = localStorage.getItem('neon_sound');
    if (v === null) return true;
    return v === '1';
  } catch {
    return true;
  }
}

enabled = isSoundEnabled();

export function playTone(kind = 'move') {
  if (!enabled) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioContext ||= new Ctx();
    if (audioContext.state === 'suspended') audioContext.resume();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const t = audioContext.currentTime;
    osc.type = 'sine';
    const base = kind === 'win' ? 650 : kind === 'error' ? 190 : kind === 'click' ? 420 : 370;
    const end = kind === 'win' ? 950 : kind === 'error' ? 140 : 510;
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(end, 1), t + 0.09);
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(gain).connect(audioContext.destination);
    osc.start(t);
    osc.stop(t + 0.17);
  } catch {
    /* optional */
  }
}
