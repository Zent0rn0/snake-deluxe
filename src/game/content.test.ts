import { describe, expect, it } from 'vitest';
import { HATS, SKINS, THEMES, MUTATORS, POWERS, mutatorById, skinById, themeById, hatById } from './content';
import { dailyChallenge } from './launch';
import { LEVELS, levelPar, starsFor } from './levels';

describe('content integrity', () => {
  it('ids are unique', () => {
    for (const list of [SKINS, HATS, THEMES, MUTATORS]) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('every theme carries a chrome tint and a rock sprite', () => {
    for (const t of THEMES) {
      expect(t.chromeTint).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.rock).toBeTruthy();
    }
  });

  it('lookups fall back to the default rather than throwing', () => {
    expect(skinById('nope').id).toBe(SKINS[0].id);
    expect(hatById('nope').id).toBe(HATS[0].id);
    expect(themeById('nope').id).toBe(THEMES[0].id);
  });

  it('skin colour functions return a usable colour at any segment', () => {
    for (const s of SKINS) {
      for (const i of [0, 3, 40]) {
        expect(typeof s.color(i, 41, 1.5)).toBe('string');
        expect(s.color(i, 41, 1.5).length).toBeGreaterThan(3);
      }
    }
  });

  it('every mutator and power referenced by the UI exists', () => {
    for (const m of MUTATORS) expect(mutatorById(m.id)).toBeTruthy();
    for (const p of Object.values(POWERS)) expect(p.sprite).toBeTruthy();
  });
});

describe('campaign levels', () => {
  it('numbers levels 1..N with a player start on every map', () => {
    LEVELS.forEach((l, i) => {
      expect(l.id).toBe(i + 1);
      expect(l.map.join('')).toContain('S');
      expect(l.goal).toBeGreaterThan(0);
    });
  });

  it('awards stars at the par boundaries', () => {
    // `starsFor` is given seconds, not milliseconds.
    const level = LEVELS[0];
    const [two, three] = levelPar(level);
    expect(three).toBeLessThan(two);
    expect(starsFor(level, three)).toBe(3);
    expect(starsFor(level, three + 1)).toBe(2);
    expect(starsFor(level, two)).toBe(2);
    expect(starsFor(level, two + 1)).toBe(1);
  });
});

describe('daily challenge', () => {
  it('is identical for everyone on the same date', () => {
    const a = dailyChallenge('2026-01-15');
    const b = dailyChallenge('2026-01-15');
    expect(a).toEqual(b);
  });

  it('differs between days', () => {
    const a = dailyChallenge('2026-01-15');
    const b = dailyChallenge('2026-01-16');
    expect([a.mutators.join(), a.speed, a.size, a.goalScore].join('|')).not.toBe(
      [b.mutators.join(), b.speed, b.size, b.goalScore].join('|'),
    );
  });

  it('never picks the cheese mutator, which would trivialise the goal', () => {
    for (let d = 1; d <= 28; d++) {
      const day = dailyChallenge(`2026-03-${String(d).padStart(2, '0')}`);
      expect(day.mutators).not.toContain('cheese');
      expect(day.mutators.length).toBe(2);
    }
  });
});
