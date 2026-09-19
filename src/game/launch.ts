import { accent, danger, info, reward, special } from '../design/tokens';
import { MUTATORS, SIZES, SPEEDS, mutatorById } from './content';
import type { GameConfig } from './engine';
import { LEVELS } from './levels';
import { Rng, hashString, todayKey } from './rng';
import type { ModeId, MutatorId } from './types';
import type { Profile } from '../store/profile';

export type Launch =
  | { mode: 'classic' }
  | { mode: 'campaign'; levelId: number }
  | { mode: 'arena' }
  | { mode: 'blitz' }
  | { mode: 'duel' }
  | { mode: 'daily' };

export interface ModeInfo {
  id: Exclude<ModeId, 'demo'>;
  name: string;
  tagline: string;
  sprite: string;
  /** One identity colour per mode, drawn from the token families. Cards carry
   *  it as a top rule and a faint wash rather than a two-hue gradient. */
  accent: string;
}

/** A sibling of `special`, so the daily reads apart from the duel. */
const DAILY_ROSE = '#c9709e';

export const MODES: ModeInfo[] = [
  { id: 'campaign', name: 'Приключение', tagline: '15 уровней: порталы, ключи, гонки', sprite: 'map', accent: accent.base },
  { id: 'arena', name: 'Арена', tagline: 'Ты против хитрых змей-ботов', sprite: 'swords', accent: danger.base },
  { id: 'blitz', name: 'Блиц', tagline: '60 секунд, фруктовый ливень', sprite: 'bolt', accent: reward.base },
  { id: 'classic', name: 'Миксер', tagline: 'Классика + модификаторы', sprite: 'cyclone', accent: info.base },
  { id: 'duel', name: 'Дуэль', tagline: 'Вдвоём за одной клавиатурой', sprite: 'gamepad', accent: special.base },
  { id: 'daily', name: 'Испытание дня', tagline: 'Новые правила каждый день', sprite: 'calendar', accent: DAILY_ROSE },
];

export function classicMultiplier(speedId: string, mutators: MutatorId[]) {
  const speed = SPEEDS.find((s) => s.id === speedId) ?? SPEEDS[1];
  const bonus = mutators.reduce((a, m) => a + mutatorById(m).bonus, 0);
  return Math.round(speed.mult * Math.max(0.5, 1 + bonus) * 10) / 10;
}

export function dailyChallenge(date = todayKey()) {
  const rng = new Rng(hashString('daily-' + date));
  const pool = MUTATORS.map((m) => m.id).filter((m) => m !== 'cheese');
  const mutators = rng.shuffle([...pool]).slice(0, 2) as MutatorId[];
  const speed = rng.pick(['normal', 'normal', 'fast'] as const);
  const size = rng.pick(['m', 'l'] as const);
  const mult = classicMultiplier(speed, mutators);
  const goalScore = Math.round(((250 + rng.int(5) * 40) * mult) / 10) * 10;
  return { date, mutators, speed, size, goalScore, seed: hashString('seed-' + date), mult };
}

const pickSize = (id: string) => SIZES.find((s) => s.id === id) ?? SIZES[1];
const pickSpeed = (id: string) => SPEEDS.find((s) => s.id === id) ?? SPEEDS[1];

export function buildConfig(launch: Launch, p: Profile, portrait: boolean): GameConfig {
  const base = {
    seed: (Math.random() * 2 ** 31) | 0,
    skin: p.equipped.skin,
    hat: p.equipped.hat,
    wrap: false,
    powerups: false,
    fruitCount: 1,
    mutators: [] as MutatorId[],
    scoreMult: 1,
  };
  const orient = (cols: number, rows: number) => portrait && cols > rows;

  switch (launch.mode) {
    case 'classic': {
      const setup = p.classicSetup;
      const size = pickSize(setup.size);
      return {
        ...base,
        mode: 'classic',
        cols: size.cols,
        rows: size.rows,
        stepMs: pickSpeed(setup.speed).ms,
        mutators: setup.mutators,
        powerups: setup.powerups,
        scoreMult: classicMultiplier(setup.speed, setup.mutators),
        transpose: orient(size.cols, size.rows),
      };
    }
    case 'campaign': {
      const level = LEVELS.find((l) => l.id === launch.levelId) ?? LEVELS[0];
      return {
        ...base,
        mode: 'campaign',
        cols: 0,
        rows: 0,
        stepMs: level.stepMs,
        level,
        transpose: orient(level.map[0].length, level.map.length),
      };
    }
    case 'arena':
      return {
        ...base,
        mode: 'arena',
        cols: 28,
        rows: 20,
        stepMs: 125,
        powerups: true,
        fruitCount: 9,
        timeLimitMs: 120000,
        bots: { count: p.arenaSetup.bots, level: p.arenaSetup.level },
        transpose: orient(28, 20),
      };
    case 'blitz':
      return {
        ...base,
        mode: 'blitz',
        cols: 19,
        rows: 15,
        stepMs: 112,
        wrap: true,
        powerups: true,
        fruitCount: 3,
        timeLimitMs: 60000,
        transpose: orient(19, 15),
      };
    case 'duel':
      return {
        ...base,
        mode: 'duel',
        cols: 23,
        rows: 17,
        stepMs: pickSpeed(p.duelSetup.speed).ms,
        powerups: true,
        fruitCount: 2,
        duelRounds: p.duelSetup.rounds,
        p2Skin: p.equipped.skin === 'sunset' ? 'ocean' : 'sunset',
        transpose: orient(23, 17),
      };
    case 'daily': {
      const d = dailyChallenge();
      const size = pickSize(d.size);
      return {
        ...base,
        mode: 'daily',
        cols: size.cols,
        rows: size.rows,
        stepMs: pickSpeed(d.speed).ms,
        seed: d.seed,
        mutators: d.mutators,
        powerups: true,
        scoreMult: d.mult,
        goalScore: d.goalScore,
        transpose: orient(size.cols, size.rows),
      };
    }
  }
}

export function demoConfig(cols: number, rows: number): GameConfig {
  return {
    mode: 'demo',
    cols,
    rows,
    stepMs: 120,
    scoreMult: 1,
    mutators: [],
    wrap: false,
    powerups: true,
    fruitCount: 12,
    bots: { count: 5, level: 2 },
    seed: (Math.random() * 2 ** 31) | 0,
    skin: 'emerald',
    hat: 'none',
    countdown: false,
  };
}
