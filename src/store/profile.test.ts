import { describe, expect, it, vi } from 'vitest';
import type { RunResult } from '../game/types';

const KEY = 'snake-deluxe-profile-v1';

/** The store reads localStorage at import time, so each case needs a fresh one. */
async function load(seed?: unknown) {
  localStorage.clear();
  if (seed !== undefined) localStorage.setItem(KEY, JSON.stringify(seed));
  vi.resetModules();
  return import('./profile');
}

function run(over: Partial<RunResult> = {}): RunResult {
  return {
    mode: 'classic',
    win: false,
    score: 300,
    length: 12,
    fruits: 20,
    timeMs: 45_000,
    maxCombo: 5,
    kills: 0,
    coinsPicked: 2,
    goldens: 1,
    powers: {},
    portals: 0,
    shieldsSaved: 0,
    stars: 0,
    rank: 1,
    mutators: [],
    reason: 'wall',
    ...over,
  };
}

describe('profile v1 → v2 migration', () => {
  it('keeps progress and converts the always-on d-pad', async () => {
    const { getProfile } = await load({
      v: 1,
      coins: 4242,
      xp: 900,
      owned: { skins: ['emerald', 'lava'], hats: ['none'], themes: ['meadow'] },
      equipped: { skin: 'lava', hat: 'none', theme: 'meadow' },
      campaign: { 1: 3, 2: 2 },
      settings: { sfx: false, music: true, volume: 0.4, vibration: true, dpad: 'on', reducedFx: true, turnSound: true },
    });
    const p = getProfile();
    // Nothing the player earned may be lost.
    expect(p.coins).toBe(4242);
    expect(p.xp).toBe(900);
    expect(p.owned.skins).toContain('lava');
    expect(p.equipped.skin).toBe('lava');
    expect(p.campaign).toEqual({ 1: 3, 2: 2 });
    // Settings that still exist are kept.
    expect(p.settings.sfx).toBe(false);
    expect(p.settings.volume).toBe(0.4);
    expect(p.settings.reducedFx).toBe(true);
    // Retired settings are translated, not dropped.
    expect(p.settings.control).toBe('dpad');
    expect(p.settings.haptics).toBe('light');
    expect(p.v).toBe(2);
    expect('dpad' in p.settings).toBe(false);
    expect('vibration' in p.settings).toBe(false);
  });

  it.each([
    ['auto', 'swipe'],
    ['off', 'swipe'],
    ['on', 'dpad'],
  ])('maps dpad:%s to control:%s', async (dpad, control) => {
    const { getProfile } = await load({ v: 1, settings: { dpad } });
    expect(getProfile().settings.control).toBe(control);
  });

  it('turns vibration off into haptics off', async () => {
    const { getProfile } = await load({ v: 1, settings: { vibration: false } });
    expect(getProfile().settings.haptics).toBe('off');
  });

  it('leaves an already-migrated profile alone', async () => {
    const { getProfile } = await load({
      v: 2,
      coins: 10,
      settings: { control: 'joystick', handedness: 'left', haptics: 'full', swipeSensitivity: 0.2 },
    });
    const p = getProfile();
    expect(p.settings.control).toBe('joystick');
    expect(p.settings.handedness).toBe('left');
    expect(p.settings.haptics).toBe('full');
    expect(p.settings.swipeSensitivity).toBe(0.2);
  });

  it('falls back to a fresh profile when storage is corrupt', async () => {
    localStorage.clear();
    localStorage.setItem(KEY, '{not json');
    vi.resetModules();
    const { getProfile } = await import('./profile');
    expect(getProfile().coins).toBe(100);
    expect(getProfile().v).toBe(2);
  });
});

describe('run rewards', () => {
  it('pays out, records the best score and banks history', async () => {
    const { applyRun, getProfile } = await load();
    const reward = applyRun(run({ score: 450 }));
    expect(reward.coins).toBeGreaterThan(0);
    expect(reward.xp).toBeGreaterThan(0);
    expect(reward.breakdown.length).toBeGreaterThan(0);
    const p = getProfile();
    expect(p.best.classic).toBe(450);
    expect(p.history.classic[0].score).toBe(450);
    expect(p.stats.games).toBe(1);
    expect(p.stats.fruits).toBe(20);
    // Unlocked achievements pay out on top of the run reward itself.
    const bonus = reward.achievements.reduce((a, x) => a + x.reward, 0);
    expect(p.coins).toBe(100 + reward.coins + bonus);
  });

  it('reports a new best only when the previous one is beaten', async () => {
    const { applyRun } = await load();
    expect(applyRun(run({ score: 200 })).newBest).toBe(true);
    const second = applyRun(run({ score: 150 }));
    expect(second.newBest).toBe(false);
    const third = applyRun(run({ score: 900 }));
    expect(third.newBest).toBe(true);
    expect(third.prevBest).toBe(200);
  });

  it('keeps at most ten history entries, best first', async () => {
    const { applyRun, getProfile } = await load();
    for (let i = 1; i <= 14; i++) applyRun(run({ score: i * 10 }));
    const hist = getProfile().history.classic;
    expect(hist.length).toBe(10);
    expect(hist[0].score).toBe(140);
    expect(hist[9].score).toBe(50);
  });

  it('counts arena wins and kills separately', async () => {
    const { applyRun, getProfile } = await load();
    applyRun(run({ mode: 'arena', win: true, kills: 3 }));
    const s = getProfile().stats;
    expect(s.arenaWins).toBe(1);
    expect(s.kills).toBe(3);
  });

  it('stores campaign stars without touching the score board', async () => {
    const { applyRun, getProfile } = await load();
    applyRun(run({ mode: 'campaign', win: true, stars: 2, levelId: 1 }));
    const p = getProfile();
    expect(p.campaign[1]).toBe(2);
    expect(p.best.campaign).toBeUndefined();
  });
});
