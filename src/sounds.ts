// 8-bit sound effects using Web Audio API
class RetroSounds {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    this.initContext();
  }

  private initContext() {
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      this.enabled = false;
    }
  }

  private ensureContext() {
    if (!this.ctx) {
      this.initContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled() {
    return this.enabled;
  }

  // Play a single tone
  private playTone(frequency: number, duration: number, type: OscillatorType = 'square', volume: number = 0.3) {
    if (!this.enabled || !this.ctx) return;
    this.ensureContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);
  }

  // Eat food sound - ascending arpeggio
  playEat() {
    if (!this.enabled || !this.ctx) return;
    this.ensureContext();

    const notes = [523, 659, 784]; // C5, E5, G5
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.1, 'square', 0.2), i * 50);
    });
  }

  // Game over sound - descending
  playGameOver() {
    if (!this.enabled || !this.ctx) return;
    this.ensureContext();

    const notes = [440, 349, 294, 220]; // A4, F4, D4, A3
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.2, 'square', 0.25), i * 150);
    });
  }

  // Move/turn sound
  playTurn() {
    this.playTone(200, 0.05, 'square', 0.1);
  }

  // Start game jingle
  playStart() {
    if (!this.enabled || !this.ctx) return;
    this.ensureContext();

    const notes = [262, 330, 392, 523]; // C4, E4, G4, C5
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.15, 'square', 0.2), i * 100);
    });
  }

  // Pause sound
  playPause() {
    this.playTone(440, 0.1, 'triangle', 0.15);
    setTimeout(() => this.playTone(330, 0.15, 'triangle', 0.15), 100);
  }

  // New high score fanfare
  playHighScore() {
    if (!this.enabled || !this.ctx) return;
    this.ensureContext();

    const notes = [523, 587, 659, 784, 880, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.15, 'square', 0.2), i * 80);
    });
  }
}

export const retroSounds = new RetroSounds();
