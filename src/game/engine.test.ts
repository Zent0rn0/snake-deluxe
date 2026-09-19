import { describe, expect, it } from 'vitest';
import { EARLY_TURN_FRAC, Engine, type GameConfig } from './engine';
import type { Dir } from './types';

function cfg(over: Partial<GameConfig> = {}): GameConfig {
  return {
    mode: 'classic',
    cols: 15,
    rows: 15,
    stepMs: 100,
    scoreMult: 1,
    mutators: [],
    wrap: false,
    powerups: false,
    fruitCount: 1,
    seed: 12345,
    skin: 'emerald',
    hat: 'none',
    countdown: false,
    ...over,
  };
}

/** Skips the countdown so tests act on a running game. */
function start(over: Partial<GameConfig> = {}) {
  const e = new Engine(cfg(over));
  e.phase = 'playing';
  return e;
}

describe('input queue', () => {
  it('rejects the current direction and a straight reversal', () => {
    const e = start();
    const dir = e.snakes[0].dir;
    expect(e.input('p1', dir)).toBe(false);
    expect(e.input('p1', ((dir + 2) % 4) as Dir)).toBe(false);
    expect(e.input('p1', ((dir + 1) % 4) as Dir)).toBe(true);
  });

  it('caps the queue at three turns', () => {
    const e = start();
    const d = e.snakes[0].dir;
    expect(e.input('p1', ((d + 1) % 4) as Dir)).toBe(true);
    expect(e.input('p1', ((d + 2) % 4) as Dir)).toBe(true);
    expect(e.input('p1', ((d + 3) % 4) as Dir)).toBe(true);
    expect(e.input('p1', ((d + 0) % 4) as Dir)).toBe(false);
    expect(e.snakes[0].queue.length).toBe(3);
  });

  it('ignores input once the snake is dead', () => {
    const e = start();
    e.snakes[0].alive = false;
    expect(e.input('p1', ((e.snakes[0].dir + 1) % 4) as Dir)).toBe(false);
  });

  it('inverts turns while the poison effect is active', () => {
    const e = start();
    const s = e.snakes[0];
    s.reversed = 2000;
    const want = ((s.dir + 1) % 4) as Dir;
    expect(e.input('p1', want)).toBe(true);
    expect(s.queue[0]).toBe(((want + 2) % 4) as Dir);
  });

  it('turns relative to the heading, left and right', () => {
    const e = start();
    const s = e.snakes[0];
    expect(e.inputRelative('p1', 1)).toBe(true);
    expect(s.queue[0]).toBe(((s.dir + 1) % 4) as Dir);
    // The second turn resolves against the first, not against the body.
    expect(e.inputRelative('p1', 1)).toBe(true);
    expect(s.queue[1]).toBe(((s.dir + 2) % 4) as Dir);
  });
});

describe('early turn', () => {
  it('commits a turn queued early in the cell on the very next frame', () => {
    const e = start();
    const s = e.snakes[0];
    const before = s.dir;
    e.update(4); // barely into the cell
    e.input('p1', ((before + 1) % 4) as Dir);
    e.update(16);
    expect(s.dir).toBe(((before + 1) % 4) as Dir);
  });

  it('leaves a turn queued late in the cell to the natural step', () => {
    const e = start();
    const s = e.snakes[0];
    const before = s.dir;
    e.update(100 * EARLY_TURN_FRAC + 10);
    e.input('p1', ((before + 1) % 4) as Dir);
    e.update(16);
    expect(s.dir).toBe(before);
    expect(s.queue.length).toBe(1);
  });

  it('does not apply to bots', () => {
    const e = start({ mode: 'arena', bots: { count: 1, level: 0 }, cols: 20, rows: 20 });
    const bot = e.snakes.find((s) => s.controller === 'bot')!;
    e.update(4);
    bot.queue.push(((bot.dir + 1) % 4) as Dir);
    e.update(16);
    expect(bot.moveAcc).toBeLessThan(e.effectiveStep(bot));
  });

  it('repays the borrowed time, so turning does not buy speed', () => {
    // Same scripted turns, same clock, with and without the feature. Wrapping
    // walls and cheese keep the snake alive so the only variable is cadence.
    const run = (earlyTurn: boolean) => {
      const e = new Engine(cfg({ earlyTurn, cols: 41, rows: 41, wrap: true, mutators: ['cheese'] }));
      e.phase = 'playing';
      const s = e.snakes[0];
      let steps = 0;
      let last = { ...s.body[0] };
      for (let frame = 0; frame < 900; frame++) {
        // Alternate turns as fast as the queue will take them.
        e.inputRelative('p1', frame % 2 === 0 ? 1 : -1);
        e.update(16);
        const h = s.body[0];
        if (h.x !== last.x || h.y !== last.y) {
          steps++;
          last = { ...h };
        }
      }
      expect(s.alive).toBe(true);
      return steps;
    };
    const base = run(false);
    const early = run(true);
    // 900 frames at 16ms over a 100ms step: ~144 cells either way.
    expect(base).toBeGreaterThan(100);
    expect(Math.abs(early - base)).toBeLessThanOrEqual(1);
  });
});

describe('movement and collision', () => {
  it('kills the snake at a wall when wrap is off', () => {
    const e = start({ cols: 9, rows: 9 });
    const s = e.snakes[0];
    for (let i = 0; i < 40 && s.alive; i++) e.update(100);
    expect(s.alive).toBe(false);
  });

  it('wraps around the edge when wrap is on', () => {
    const e = start({ cols: 9, rows: 9, wrap: true });
    const s = e.snakes[0];
    for (let i = 0; i < 40; i++) e.update(100);
    expect(s.alive).toBe(true);
  });

  it('lets the head enter the cell the tail is leaving', () => {
    // The classic snake bug: a full-length turn into your own vacating tail.
    const e = start({ cols: 21, rows: 21 });
    const s = e.snakes[0];
    expect(s.grow).toBe(0);
    for (let i = 0; i < 4; i++) {
      e.inputRelative('p1', 1);
      e.update(100);
    }
    expect(s.alive).toBe(true);
  });
});

describe('determinism', () => {
  it('two engines with the same seed and inputs stay identical', () => {
    const snap = (e: Engine) =>
      JSON.stringify({
        bodies: e.snakes.map((s) => s.body),
        items: e.items.map((i) => [i.kind, i.x, i.y]),
        score: e.snakes.map((s) => s.score),
      });
    const drive = () => {
      const e = new Engine(cfg({ seed: 99, cols: 21, rows: 21 }));
      e.phase = 'playing';
      for (let f = 0; f < 400; f++) {
        if (f % 23 === 0) e.inputRelative('p1', 1);
        e.update(16);
      }
      return snap(e);
    };
    expect(drive()).toBe(drive());
  });
});
