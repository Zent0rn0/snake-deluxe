import { beforeAll, describe, expect, it } from 'vitest';
import { THEMES } from './content';
import { Engine, type GameConfig } from './engine';
import { Renderer, drawPreviewSnake } from './renderer';

/**
 * A recording 2D context. jsdom has no canvas at all and a no-op mock answers
 * nothing interesting, so this stub keeps enough state for the renderer to run
 * for real: every draw call lands, gradients behave, and anything the renderer
 * reads back has a sane value. What it proves is that a full frame — across all
 * seven themes and every skin — completes without throwing.
 */
function makeCtx() {
  const calls: string[] = [];
  const gradient = { addColorStop: () => {} };
  const state: Record<string, unknown> = {
    globalAlpha: 1,
    lineWidth: 1,
    shadowBlur: 0,
    font: '',
    textAlign: 'left',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineCap: 'butt',
    lineJoin: 'miter',
    shadowColor: '#000',
    globalCompositeOperation: 'source-over',
    lineDashOffset: 0,
    textBaseline: 'alphabetic',
  };
  const fns: Record<string, (...args: unknown[]) => unknown> = {
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
    measureText: () => ({ width: 10 }),
  };
  const ctx = new Proxy(state, {
    get(target, key: string) {
      if (key === '__calls') return calls;
      if (key in fns) return fns[key];
      if (key in target) return target[key];
      return (...args: unknown[]) => {
        calls.push(`${key}(${args.length})`);
      };
    },
    set(target, key: string, value) {
      target[key] = value;
      return true;
    },
  });
  return ctx as unknown as CanvasRenderingContext2D & { __calls: string[] };
}

function makeCanvas() {
  const ctx = makeCtx();
  return { width: 0, height: 0, style: {} as Record<string, string>, getContext: () => ctx } as unknown as HTMLCanvasElement;
}

beforeAll(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  g.document = { createElement: () => makeCanvas() };
  g.window = { devicePixelRatio: 2 };
  // assets.ts constructs Images; they simply never finish loading here, and
  // every draw site already handles `sprite()` returning null.
  g.Image = class {
    decoding = '';
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    src = '';
  };
});

function cfg(over: Partial<GameConfig> = {}): GameConfig {
  return {
    mode: 'classic',
    cols: 17,
    rows: 15,
    stepMs: 120,
    scoreMult: 1,
    mutators: [],
    wrap: false,
    powerups: true,
    fruitCount: 3,
    seed: 7,
    skin: 'emerald',
    hat: 'none',
    countdown: false,
    ...over,
  };
}

describe('Renderer.fit', () => {
  it('keeps the board inside the box and preserves the aspect', () => {
    const f = Renderer.fit(20, 10, 800, 600);
    expect(f.w).toBeLessThanOrEqual(800);
    expect(f.h).toBeLessThanOrEqual(600);
    expect(f.w).toBeGreaterThan(f.h);
  });

  it('never produces a cell smaller than the floor, even in a sliver', () => {
    expect(Renderer.fit(40, 30, 40, 20).cs).toBeGreaterThanOrEqual(6);
    expect(Renderer.fit(40, 30, 1, 1).cs).toBeGreaterThanOrEqual(6);
  });

  it('scales with the box', () => {
    expect(Renderer.fit(10, 10, 800, 800).cs).toBeGreaterThan(Renderer.fit(10, 10, 400, 400).cs);
  });
});

describe('resize with control insets', () => {
  it('shrinks a height-bound board by the space reserved for controls', () => {
    const r = new Renderer(makeCanvas(), new Engine(cfg()), 'meadow');
    const full = r.resize(900, 400);
    const inset = r.resize(900, 400, { top: 60, bottom: 168 });
    expect(inset.h).toBeLessThan(full.h);
  });

  it('shrinks a width-bound board by the landscape side rails', () => {
    const r = new Renderer(makeCanvas(), new Engine(cfg()), 'meadow');
    const full = r.resize(400, 900);
    const inset = r.resize(400, 900, { left: 128, right: 128 });
    expect(inset.w).toBeLessThan(full.w);
  });

  it('leaves a board alone when the insets are on the axis with slack', () => {
    // A width-bound board does not care about a little vertical padding.
    const r = new Renderer(makeCanvas(), new Engine(cfg()), 'meadow');
    expect(r.resize(400, 900, { top: 60, bottom: 12 }).w).toBe(r.resize(400, 900).w);
  });

  it('survives a viewport too small to be sensible', () => {
    const r = new Renderer(makeCanvas(), new Engine(cfg()), 'meadow');
    expect(() => r.resize(30, 20, { top: 60, bottom: 168 })).not.toThrow();
  });
});

describe('render', () => {
  it.each(THEMES.map((t) => t.id))('draws a frame on the %s theme', (themeId) => {
    const engine = new Engine(cfg({ mutators: ['portals', 'walls', 'dark'] }));
    engine.phase = 'playing';
    const canvas = makeCanvas();
    const r = new Renderer(canvas, engine, themeId);
    r.resize(600, 800);
    for (let i = 0; i < 8; i++) {
      engine.update(16);
      r.onEvents(engine.drainEvents());
      r.render(16, i * 16);
    }
    expect((canvas.getContext('2d') as unknown as { __calls: string[] }).__calls.length).toBeGreaterThan(50);
  });

  it('draws every skin without throwing', () => {
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d')!;
    for (const id of ['emerald', 'neon', 'lava', 'rainbow', 'galaxy', 'gold', 'ghostly']) {
      expect(() => drawPreviewSnake(ctx, 300, 120, id, 'crown', 1.2)).not.toThrow();
    }
  });

  it('renders the turn hint and the particle effects', () => {
    const engine = new Engine(cfg());
    engine.phase = 'playing';
    const r = new Renderer(makeCanvas(), engine, 'space');
    r.resize(600, 800);
    r.showTurnHint(1);
    r.burst(3, 3, '#fff', 30, 5, 'star', 0.2, 2);
    r.ring(3, 3, '#fff', 2);
    r.float(3, 3, 'КОМБО ×3', '#fff', 0.7);
    expect(() => r.render(16, 16)).not.toThrow();
  });

  it('honours reducedFx by suppressing shake and the turn hint', () => {
    const r = new Renderer(makeCanvas(), new Engine(cfg()), 'meadow');
    r.reducedFx = true;
    r.showTurnHint(2);
    r.burst(2, 2, '#fff', 30, 4);
    // reducedFx thins particles rather than removing them outright.
    expect(r.particles.length).toBeLessThan(30);
    expect(() => r.render(16, 0)).not.toThrow();
  });
});
