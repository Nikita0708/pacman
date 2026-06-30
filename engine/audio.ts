/**
 * Web Audio API synthesiser.
 *
 * All sounds are generated procedurally — no asset files required. The
 * AudioContext is created lazily on the first `play()` call so it always
 * follows a user gesture and avoids browser autoplay blocks.
 *
 * Every sound is built from short-lived oscillator/gain node pairs that are
 * scheduled in advance and auto-disconnect when they stop, so there is no
 * manual node management and no per-frame overhead.
 */
import { SoundEffect } from './types';

export interface AudioPlayer {
  play: (effect: SoundEffect) => void;
  dispose: () => void;
}

export const createAudioPlayer = (): AudioPlayer => {
  let ctx: AudioContext | null = null;
  let chompPhase = 0;

  const getCtx = (): AudioContext => {
    if (ctx === null) {
      ctx = new AudioContext();
    }
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    return ctx;
  };

  /** Plays a single tone that decays to silence over `duration` seconds. */
  const tone = (
    frequency: number,
    startTime: number,
    duration: number,
    type: OscillatorType,
    gainValue: number,
  ): void => {
    const context = getCtx();
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.connect(gain);
    gain.connect(context.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(gainValue, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration);
  };

  /** Sweeps frequency from `freqStart` to `freqEnd` over `duration` seconds. */
  const sweep = (
    freqStart: number,
    freqEnd: number,
    startTime: number,
    duration: number,
    type: OscillatorType,
    gainValue: number,
  ): void => {
    const context = getCtx();
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.connect(gain);
    gain.connect(context.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, startTime);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, startTime + duration);
    gain.gain.setValueAtTime(gainValue, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration);
  };

  const play = (effect: SoundEffect): void => {
    const context = getCtx();
    const now = context.currentTime;

    switch (effect) {
      case SoundEffect.GAME_START:
        // 3-note ascending fanfare: C4 → E4 → G4
        tone(262, now, 0.18, 'square', 0.22);
        tone(330, now + 0.18, 0.18, 'square', 0.22);
        tone(392, now + 0.36, 0.32, 'square', 0.22);
        break;

      case SoundEffect.CHOMP: {
        // Alternating waka-waka pitches
        const freq = chompPhase === 0 ? 220 : 185;
        chompPhase = 1 - chompPhase;
        tone(freq, now, 0.06, 'square', 0.12);
        break;
      }

      case SoundEffect.POWER_PELLET:
        sweep(140, 70, now, 0.28, 'sawtooth', 0.28);
        break;

      case SoundEffect.EAT_GHOST:
        // 3-step descending blip
        tone(560, now, 0.07, 'square', 0.28);
        tone(370, now + 0.07, 0.07, 'square', 0.28);
        tone(190, now + 0.14, 0.12, 'square', 0.28);
        break;

      case SoundEffect.DEATH:
        // Descending warble, matches DEATH_ANIMATION_MS duration
        sweep(480, 80, now, 1.2, 'sawtooth', 0.32);
        sweep(380, 60, now + 0.1, 1.1, 'triangle', 0.18);
        break;

      case SoundEffect.EXTRA_LIFE:
        // 5-note ascending arpeggio
        [523, 659, 784, 1047, 1319].forEach((f, i) => {
          tone(f, now + i * 0.09, 0.14, 'square', 0.19);
        });
        break;

      case SoundEffect.VICTORY:
        // C-major scale up, then a long held note
        [262, 294, 330, 349, 392, 440, 494, 523].forEach((f, i) => {
          tone(f, now + i * 0.09, 0.14, 'square', 0.2);
        });
        tone(523, now + 0.78, 0.55, 'square', 0.2);
        break;
    }
  };

  const dispose = (): void => {
    if (ctx !== null) {
      void ctx.close();
      ctx = null;
    }
  };

  return { play, dispose };
};
