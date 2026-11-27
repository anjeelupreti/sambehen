'use client';

/**
 * What an open tab does when a notification arrives: a short "ting", and
 * when the tab is in the background, a title that says something came in.
 */

const SOUND_KEY = 'howdi:notification-sound';
const MESSAGE_KINDS = new Set(['player_message', 'team_message', 'team_reply', 'player_waiting']);

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    // Without storage the default (on) stands.
  }
}

let audio: AudioContext | null = null;

/**
 * Browsers only let a page make sound after someone has interacted with
 * it, so the audio is set up on the first tap or key press.
 */
export function primeSound() {
  const unlock = () => {
    try {
      audio ??= new AudioContext();
      void audio.resume();
    } catch {
      // No Web Audio; notifications stay silent.
    }
  };
  window.addEventListener('pointerdown', unlock, { once: true, capture: true });
  window.addEventListener('keydown', unlock, { once: true, capture: true });
  return () => {
    window.removeEventListener('pointerdown', unlock, { capture: true });
    window.removeEventListener('keydown', unlock, { capture: true });
  };
}

/** Only one open tab plays the sound for a given notification. */
function claim(id: string): boolean {
  try {
    const key = `howdi:ting:${id}`;
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, '1');
    setTimeout(() => localStorage.removeItem(key), 60_000);
    return true;
  } catch {
    return true;
  }
}

/** A soft two-note bell, made in the browser so there is no file to load. */
export function playTing(id: string) {
  if (!soundEnabled() || !claim(id)) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    const start = audio.currentTime + 0.01;
    for (const [frequency, delay, level] of [
      [1318.5, 0, 0.18],
      [1760, 0.09, 0.14],
    ] as const) {
      const tone = audio.createOscillator();
      const gain = audio.createGain();
      tone.type = 'sine';
      tone.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start + delay);
      gain.gain.linearRampToValueAtTime(level, start + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + 0.6);
      tone.connect(gain).connect(audio.destination);
      tone.start(start + delay);
      tone.stop(start + delay + 0.65);
    }
  } catch {
    // Sound is a nicety; the bell still shows it.
  }
}

let unseen = 0;
let unseenMessages = 0;
let baseTitle = '';
let flasher: ReturnType<typeof setInterval> | null = null;

function restoreTitle() {
  if (flasher) clearInterval(flasher);
  flasher = null;
  if (baseTitle) document.title = baseTitle;
  baseTitle = '';
  unseen = 0;
  unseenMessages = 0;
}

/** Keeps the title honest once the person comes back to the tab. */
export function watchVisibility() {
  const onVisible = () => {
    if (document.visibilityState === 'visible') restoreTitle();
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => document.removeEventListener('visibilitychange', onVisible);
}

/** "(2) New messages" in the tab, alternating with the page's own title. */
export function flagTitle(kind: string) {
  if (document.visibilityState === 'visible') return;
  if (!baseTitle) baseTitle = document.title;
  unseen += 1;
  if (MESSAGE_KINDS.has(kind)) unseenMessages += 1;

  const label =
    unseenMessages === unseen
      ? unseen === 1
        ? 'New message'
        : 'New messages'
      : unseen === 1
        ? 'New notification'
        : 'New notifications';
  const alert = `(${unseen}) ${label}`;
  document.title = alert;

  if (flasher) clearInterval(flasher);
  let showingAlert = true;
  flasher = setInterval(() => {
    showingAlert = !showingAlert;
    document.title = showingAlert ? alert : baseTitle;
  }, 1500);
}
