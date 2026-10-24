import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAudioAdapter } from '../../src/audio';

// Minimal AudioContext stand-in: state and resume behaviour are controlled by the test.
class FakeAudioContext extends EventTarget {
  static last: FakeAudioContext;
  static resumeWorks = true;
  state: AudioContextState = 'suspended';
  currentTime = 0;
  destination = {};
  oscillators = 0;
  resumeCalls = 0;

  constructor() {
    super();
    FakeAudioContext.last = this;
  }

  resume(): Promise<void> {
    this.resumeCalls++;
    // A blocked resume never settles, like a browser waiting for a gesture.
    if (!FakeAudioContext.resumeWorks) return new Promise(() => {});
    this.setState('running');
    return Promise.resolve();
  }

  setState(state: AudioContextState): void {
    this.state = state;
    this.dispatchEvent(new Event('statechange'));
  }

  createOscillator() {
    this.oscillators++;
    return {
      type: '',
      frequency: { value: 0 },
      connect: (node: unknown) => node,
      start() {},
      stop() {},
      onended: null,
    };
  }

  createGain() {
    const param = { setValueAtTime() {}, linearRampToValueAtTime() {} };
    return { gain: param, connect: (node: unknown) => node };
  }
}

function setup({ resumeWorks = true, supported = true } = {}) {
  FakeAudioContext.resumeWorks = resumeWorks;
  vi.stubGlobal('window', supported ? { AudioContext: FakeAudioContext } : {});
  const statuses: boolean[] = [];
  const audio = createAudioAdapter({ onStatus: (available) => statuses.push(available) });
  return { audio, statuses };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('audio adapter', () => {
  it('plays a tone once unlocked', async () => {
    const { audio, statuses } = setup();
    audio.unlock();
    await Promise.resolve();
    audio.play('blue', 100);
    expect(FakeAudioContext.last.oscillators).toBe(1);
    expect(statuses).toEqual([true]);
  });

  it('reports no sound when Web Audio is missing', () => {
    const { audio, statuses } = setup({ supported: false });
    audio.unlock();
    audio.play('red', 100);
    expect(statuses).toEqual([false]);
  });

  it('reports a blocked context when a tone is due, and keeps trying quietly', async () => {
    const { audio, statuses } = setup({ resumeWorks: false });
    audio.unlock();
    await Promise.resolve();
    expect(statuses).toEqual([]);

    audio.play('green', 100);
    expect(statuses).toEqual([false]);
    expect(FakeAudioContext.last.oscillators).toBe(0);
    expect(FakeAudioContext.last.resumeCalls).toBe(2);
  });

  it('clears the failure once the context runs again', async () => {
    const { audio, statuses } = setup();
    audio.unlock();
    await Promise.resolve();
    const ctx = FakeAudioContext.last;

    // The browser suspends sound while the page is in the background, and blocks resuming it.
    FakeAudioContext.resumeWorks = false;
    ctx.setState('interrupted' as AudioContextState);
    audio.play('yellow', 100);
    expect(statuses).toEqual([true, false]);

    // The next press is a gesture and resuming succeeds.
    FakeAudioContext.resumeWorks = true;
    audio.unlock();
    expect(statuses).toEqual([true, false, true]);
    audio.play('yellow', 100);
    expect(ctx.oscillators).toBe(1);
  });
});
