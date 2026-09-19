import { ZZFX } from 'zzfx';

// ZzFX parameter lists: volume, randomness, frequency, attack, sustain, release, shape, shapeCurve,
// slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay,
// sustainVolume, decay, tremolo, filter
const PRESETS = {
  eat: [1.1, 0, 520, 0.005, 0.03, 0.12, 1, 1.6, 0, 0, 280, 0.035, 0, 0, 0, 0, 0, 0.7, 0.02],
  orb: [0.6, 0, 900, 0, 0.02, 0.06, 1, 1.4, 0, 0, 200, 0.02],
  golden: [1.3, 0, 660, 0.01, 0.1, 0.3, 1, 1.8, 0, 0, 440, 0.05, 0.06, 0, 0, 0, 0.04, 0.8, 0.04],
  coin: [0.9, 0, 1675, 0, 0.04, 0.22, 1, 1.8, 0, 0, 837, 0.05],
  power: [1, 0, 260, 0.02, 0.14, 0.28, 0, 1.4, 14, 0, 0, 0, 0.04, 0, 0, 0, 0, 0.8, 0.05],
  powerEnd: [0.6, 0, 520, 0.01, 0.05, 0.2, 0, 1, -14],
  turn: [0.18, 0, 190, 0, 0.008, 0.03, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5],
  die: [1.5, 0, 110, 0.02, 0.18, 0.55, 3, 2.4, -3, 0, 0, 0, 0, 0.6, 0, 0.2, 0, 0.6, 0.2],
  shield: [1.1, 0, 240, 0, 0.06, 0.3, 2, 1, -5, 0, 0, 0, 0, 0.25],
  portal: [0.9, 0, 180, 0.05, 0.1, 0.28, 0, 1, 20, 0, 0, 0, 0.05, 0, 18],
  poison: [1, 0, 140, 0.02, 0.18, 0.3, 2, 1, 0, 0, -40, 0.1, 0, 0, 9, 0, 0, 0.7],
  beep: [0.7, 0, 440, 0, 0.08, 0.08, 0, 1],
  go: [0.9, 0, 880, 0, 0.14, 0.22, 0, 1, 0, 0, 440, 0.06],
  click: [0.45, 0, 880, 0, 0.01, 0.045, 0, 1.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5],
  buy: [1, 0, 988, 0.01, 0.08, 0.3, 1, 1.5, 0, 0, 494, 0.07, 0.06],
  rock: [0.9, 0, 70, 0.01, 0.05, 0.2, 4, 1, -2, 0, 0, 0, 0, 1],
  unlock: [1, 0, 660, 0.01, 0.1, 0.3, 1, 1.4, 0, 0, 660, 0.07, 0.09],
  tick: [0.35, 0, 1300, 0, 0.004, 0.02, 1, 2],
  kill: [1.1, 0, 320, 0.01, 0.1, 0.3, 2, 1.5, -8, 0, 220, 0.05],
  whoosh: [0.5, 0, 400, 0.04, 0.05, 0.15, 4, 1, 6, 0, 0, 0, 0, 0.8],
  clock: [0.9, 0, 1200, 0, 0.03, 0.1, 1, 1, 0, 0, 0, 0, 0.07],
} as const;

export type SfxName = keyof typeof PRESETS;

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class AudioManager {
  ctx: AudioContext;
  private master: GainNode;
  private sfxBus: GainNode;
  private musicBus: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  private noise: AudioBuffer;
  sfxOn = true;
  musicOn = true;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private nextNoteTime = 0;
  private track: 'menu' | 'game' = 'menu';
  private tempo = 1;

  constructor() {
    this.ctx = ZZFX.audioContext;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.32;
    this.musicBus.connect(this.master);
    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.3, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  unlock() {
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolume(v: number) {
    this.master.gain.value = v;
  }

  private buffer(name: SfxName): AudioBuffer {
    let b = this.buffers.get(name);
    if (!b) {
      const params = [...PRESETS[name]] as number[];
      params[1] = 0; // no randomness in the cached buffer; we vary playback rate instead
      const samples = ZZFX.buildSamples(...params);
      b = this.ctx.createBuffer(1, samples.length || 1, ZZFX.sampleRate);
      b.getChannelData(0).set(samples);
      this.buffers.set(name, b);
    }
    return b;
  }

  play(name: SfxName, opts: { rate?: number; volume?: number } = {}) {
    if (!this.sfxOn || this.ctx.state !== 'running') return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer(name);
    src.playbackRate.value = (opts.rate ?? 1) * (0.97 + Math.random() * 0.06);
    const g = this.ctx.createGain();
    g.gain.value = (opts.volume ?? 1) * 0.3;
    src.connect(g).connect(this.sfxBus);
    src.start();
  }

  /** Short melodic jingle made from simple notes (midi numbers). */
  jingle(notes: number[], stepSec = 0.09, type: OscillatorType = 'square', vol = 0.12) {
    if (!this.sfxOn || this.ctx.state !== 'running') return;
    const t0 = this.ctx.currentTime + 0.01;
    notes.forEach((n, i) => {
      if (n <= 0) return;
      this.tone(NOTE(n), t0 + i * stepSec, stepSec * 1.6, type, vol, this.sfxBus);
    });
  }

  win() {
    this.jingle([72, 76, 79, 84, 0, 79, 84, 88], 0.09, 'square', 0.1);
  }
  lose() {
    this.jingle([67, 63, 60, 55], 0.14, 'triangle', 0.16);
  }
  achievement() {
    this.jingle([79, 83, 86, 91], 0.07, 'square', 0.09);
  }
  levelUp() {
    this.jingle([60, 64, 67, 72, 76, 79, 84], 0.06, 'triangle', 0.16);
  }

  private tone(freq: number, when: number, dur: number, type: OscillatorType, vol: number, bus: AudioNode, filter?: number) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    let node: AudioNode = osc;
    if (filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      osc.connect(f);
      node = f;
    }
    node.connect(g).connect(bus);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  private drum(kind: 'kick' | 'hat' | 'snare', when: number) {
    if (kind === 'kick') {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.frequency.setValueAtTime(150, when);
      osc.frequency.exponentialRampToValueAtTime(40, when + 0.12);
      g.gain.setValueAtTime(0.55, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.18);
      osc.connect(g).connect(this.musicBus);
      osc.start(when);
      osc.stop(when + 0.2);
      return;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = kind === 'hat' ? 'highpass' : 'bandpass';
    f.frequency.value = kind === 'hat' ? 7000 : 1800;
    const g = this.ctx.createGain();
    const len = kind === 'hat' ? 0.04 : 0.12;
    g.gain.setValueAtTime(kind === 'hat' ? 0.12 : 0.22, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + len);
    src.connect(f).connect(g).connect(this.musicBus);
    src.start(when);
    src.stop(when + len + 0.02);
  }

  // ─── Music ────────────────────────────────────────────────────────────

  setTrack(track: 'menu' | 'game', tempo = 1) {
    this.track = track;
    this.tempo = tempo;
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  startMusic() {
    if (!this.musicOn || this.musicTimer !== null) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicStep = 0;
    this.musicTimer = window.setInterval(() => this.schedule(), 30);
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private schedule() {
    if (this.ctx.state !== 'running') {
      this.nextNoteTime = this.ctx.currentTime + 0.1;
      return;
    }
    const bpm = (this.track === 'menu' ? 96 : 118) * this.tempo;
    const stepDur = 60 / bpm / 4;
    while (this.nextNoteTime < this.ctx.currentTime + 0.15) {
      this.playStep(this.musicStep, this.nextNoteTime, stepDur);
      this.nextNoteTime += stepDur;
      this.musicStep = (this.musicStep + 1) % 64;
    }
  }

  private playStep(step: number, when: number, stepDur: number) {
    // I–vi–IV–V in C, one bar each.
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const roots = [48, 45, 41, 43];
    const chords = [
      [60, 64, 67, 71],
      [57, 60, 64, 67],
      [53, 57, 60, 64],
      [55, 59, 62, 67],
    ];
    const root = roots[bar];
    const chord = chords[bar];
    const game = this.track === 'game';

    if (s % 4 === 0) this.tone(NOTE(root), when, stepDur * (game ? 2.5 : 3.8), 'triangle', 0.22, this.musicBus);
    if (game && s === 6) this.tone(NOTE(root + 12), when, stepDur * 1.5, 'triangle', 0.16, this.musicBus);

    const arpPattern = game ? [0, 1, 2, 3, 2, 1, 2, 3] : [0, 2, 1, 3, 2, 3, 1, 2];
    if (s % 2 === 0) {
      const note = chord[arpPattern[s / 2]] + 12;
      this.tone(NOTE(note), when, stepDur * 1.8, game ? 'square' : 'sine', game ? 0.035 : 0.06, this.musicBus, 2400);
    }

    // Tiny melody over the top every other loop.
    if (game && step >= 32 && (s === 0 || s === 3 || s === 10)) {
      const mel = chord[(s + bar) % 4] + 24;
      this.tone(NOTE(mel), when, stepDur * 2, 'triangle', 0.05, this.musicBus);
    }

    if (game) {
      if (s === 0 || s === 8) this.drum('kick', when);
      if (s === 4 || s === 12) this.drum('snare', when);
      if (s % 2 === 1) this.drum('hat', when);
    } else if (s === 0) {
      this.drum('kick', when);
    }
  }
}

export const audio = new AudioManager();

export function vibrate(pattern: number | number[]) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    /* unsupported */
  }
}
