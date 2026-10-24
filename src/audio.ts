import type { Color } from './game/engine';

// Fixed tone per color, inspired by the original Simon. See ADR-7.
export const FREQUENCIES: Record<Color, number> = {
  blue: 209,
  red: 310,
  yellow: 252,
  green: 415,
};

const VOLUME = 0.25;
const RAMP_S = 0.02;

export interface AudioAdapterOptions {
  /** Called with false when sound is unavailable, and with true once it works again. */
  onStatus(available: boolean): void;
}

type AudioContextConstructor = typeof AudioContext;

function getAudioContextConstructor(): AudioContextConstructor | undefined {
  const w = window as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return w.AudioContext ?? w.webkitAudioContext;
}

// Single AudioContext; sound failures never throw into the game.
export function createAudioAdapter({ onStatus }: AudioAdapterOptions) {
  let context: AudioContext | null = null;
  let available: boolean | null = null;
  const active = new Set<OscillatorNode>();

  function report(next: boolean): void {
    if (available === next) return;
    available = next;
    onStatus(next);
  }

  function createContext(Ctor: AudioContextConstructor): AudioContext {
    const ctx = new Ctor();
    // Sound coming back (for example after a later press) clears the notice.
    ctx.addEventListener('statechange', () => {
      if (ctx.state === 'running') report(true);
    });
    return ctx;
  }

  /** Best called from inside a user gesture (start, play again, back to game, pad press). */
  function unlock(): void {
    try {
      const Ctor = getAudioContextConstructor();
      if (!Ctor) throw new Error('Web Audio is not supported');
      context ??= createContext(Ctor);
      if (context.state === 'running') {
        report(true);
        return;
      }
      const ctx = context;
      // A blocked resume may never settle; play() then reports the failure instead.
      ctx.resume().then(
        () => report(ctx.state === 'running'),
        () => report(false),
      );
    } catch {
      report(false);
    }
  }

  function play(color: Color, ms: number): void {
    if (!context) return;
    if (context.state !== 'running') {
      // Suspended or interrupted (for example after the page was in the background):
      // keep the lights going, show the notice and quietly try again.
      report(false);
      context.resume().catch(() => {});
      return;
    }
    try {
      const now = context.currentTime;
      const end = now + ms / 1000;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.value = FREQUENCIES[color];
      // Short attack and release envelope avoids audible clicks.
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(VOLUME, now + RAMP_S);
      gain.gain.setValueAtTime(VOLUME, Math.max(now + RAMP_S, end - RAMP_S));
      gain.gain.linearRampToValueAtTime(0, end);
      oscillator.connect(gain).connect(context.destination);
      oscillator.onended = () => active.delete(oscillator);
      active.add(oscillator);
      oscillator.start(now);
      oscillator.stop(end);
    } catch {
      report(false);
    }
  }

  function stopAll(): void {
    for (const oscillator of active) {
      try {
        oscillator.stop();
      } catch {
        // Already stopped.
      }
    }
    active.clear();
  }

  return { unlock, play, stopAll };
}

export type AudioAdapter = ReturnType<typeof createAudioAdapter>;
