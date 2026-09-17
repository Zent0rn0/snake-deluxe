import { useSyncExternalStore } from 'react';
import { HATS, SKINS, THEMES, POWER_LIST } from '../game/content';
import { LEVELS } from '../game/levels';
import { Rng, hashString, todayKey } from '../game/rng';
import type { ModeId, MutatorId, PowerId, RunResult } from '../game/types';

// ─── Shape ──────────────────────────────────────────────────────────────────

export interface Settings {
  sfx: boolean;
  music: boolean;
  volume: number;
  vibration: boolean;
  dpad: 'auto' | 'on' | 'off';
  reducedFx: boolean;
  turnSound: boolean;
}

export interface QuestState {
  id: string;
  target: number;
  progress: number;
  reward: number;
  claimed: boolean;
}

export interface Stats {
  games: number;
  fruits: number;
  maxCombo: number;
  maxLength: number;
  kills: number;
  arenaWins: number;
  duels: number;
  portals: number;
  goldens: number;
  shieldsSaved: number;
  coinsEarned: number;
  playTimeMs: number;
  powers: Partial<Record<PowerId, number>>;
  dailyWins: number;
  spins: number;
  purchases: number;
  blenderGames: number;
  bestScore: number;
}

export interface Profile {
  v: 1;
  coins: number;
  xp: number;
  owned: { skins: string[]; hats: string[]; themes: string[] };
  equipped: { skin: string; hat: string; theme: string };
  settings: Settings;
  best: Record<string, number>;
  campaign: Record<number, number>;
  stats: Stats;
  achievements: Record<string, number>;
  quests: { date: string; list: QuestState[] };
  wheel: { lastFree: string };
  daily: { date: string; best: number; rewarded: boolean };
  classicSetup: { speed: string; size: string; mutators: MutatorId[]; powerups: boolean };
  arenaSetup: { bots: number; level: number };
  duelSetup: { rounds: number; speed: string };
  history: Record<string, { score: number; date: string }[]>;
  tutorialSeen: boolean;
}

const KEY = 'snake-deluxe-profile-v1';

function fresh(): Profile {
  return {
    v: 1,
    coins: 100,
    xp: 0,
    owned: { skins: ['emerald'], hats: ['none'], themes: ['meadow'] },
    equipped: { skin: 'emerald', hat: 'none', theme: 'meadow' },
    settings: { sfx: true, music: true, volume: 0.8, vibration: true, dpad: 'auto', reducedFx: false, turnSound: false },
    best: {},
    campaign: {},
    stats: {
      games: 0, fruits: 0, maxCombo: 0, maxLength: 0, kills: 0, arenaWins: 0, duels: 0, portals: 0, goldens: 0,
      shieldsSaved: 0, coinsEarned: 0, playTimeMs: 0, powers: {}, dailyWins: 0, spins: 0, purchases: 0, blenderGames: 0, bestScore: 0,
    },
    achievements: {},
    quests: { date: '', list: [] },
    wheel: { lastFree: '' },
    daily: { date: '', best: 0, rewarded: false },
    classicSetup: { speed: 'normal', size: 'm', mutators: [], powerups: true },
    arenaSetup: { bots: 3, level: 1 },
    duelSetup: { rounds: 3, speed: 'normal' },
    history: {},
    tutorialSeen: false,
  };
}

function load(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const parsed = JSON.parse(raw);
    const base = fresh();
    return {
      ...base,
      ...parsed,
      owned: { ...base.owned, ...parsed.owned },
      equipped: { ...base.equipped, ...parsed.equipped },
      settings: { ...base.settings, ...parsed.settings },
      stats: { ...base.stats, ...parsed.stats },
      classicSetup: { ...base.classicSetup, ...parsed.classicSetup },
      arenaSetup: { ...base.arenaSetup, ...parsed.arenaSetup },
      duelSetup: { ...base.duelSetup, ...parsed.duelSetup },
    };
  } catch {
    return fresh();
  }
}

let state: Profile = load();
const listeners = new Set<() => void>();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable (private mode) — progress lives for this session only */
  }
}

export function getProfile() {
  return state;
}

export function setProfile(fn: (p: Profile) => Profile | void) {
  const draft: Profile = structuredClone(state);
  const out = fn(draft);
  state = out ?? draft;
  save();
  listeners.forEach((l) => l());
}

export function useProfile(): Profile {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

export function resetProfile() {
  state = fresh();
  save();
  listeners.forEach((l) => l());
}

// ─── Levels / XP ────────────────────────────────────────────────────────────

export function levelInfo(xp: number) {
  let level = 1;
  let need = 200;
  let rest = xp;
  while (rest >= need) {
    rest -= need;
    level++;
    need = 200 + (level - 1) * 90;
  }
  return { level, into: rest, need };
}

// ─── Achievements ───────────────────────────────────────────────────────────

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  sprite: string;
  reward: number;
  check: (p: Profile) => boolean;
  progress?: (p: Profile) => [number, number];
}

const campaignDone = (p: Profile) => Object.values(p.campaign).filter((s) => s > 0).length;
const campaignStars = (p: Profile) => Object.values(p.campaign).reduce((a, b) => a + b, 0);
const ownedCount = (p: Profile) => p.owned.skins.length + p.owned.hats.length + p.owned.themes.length - 3;

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first', name: 'Первый укус', desc: 'Сыграй первую игру', sprite: 'apple', reward: 20, check: (p) => p.stats.games >= 1 },
  { id: 'fruits100', name: 'Гурман', desc: 'Съешь 100 фруктов', sprite: 'grapes', reward: 50, check: (p) => p.stats.fruits >= 100, progress: (p) => [p.stats.fruits, 100] },
  { id: 'fruits1000', name: 'Ненасытный', desc: 'Съешь 1000 фруктов', sprite: 'watermelon', reward: 250, check: (p) => p.stats.fruits >= 1000, progress: (p) => [p.stats.fruits, 1000] },
  { id: 'score500', name: 'Полтысячи', desc: 'Набери 500 очков за игру', sprite: 'hundred', reward: 60, check: (p) => p.stats.bestScore >= 500, progress: (p) => [p.stats.bestScore, 500] },
  { id: 'score1500', name: 'Мастер змей', desc: 'Набери 1500 очков за игру', sprite: 'glowing_star', reward: 150, check: (p) => p.stats.bestScore >= 1500, progress: (p) => [p.stats.bestScore, 1500] },
  { id: 'combo8', name: 'Комбо-мастер', desc: 'Съешь 8 фруктов в одном комбо', sprite: 'fire', reward: 80, check: (p) => p.stats.maxCombo >= 8, progress: (p) => [p.stats.maxCombo, 8] },
  { id: 'combo15', name: 'В ударе', desc: 'Комбо из 15 фруктов', sprite: 'collision', reward: 160, check: (p) => p.stats.maxCombo >= 15, progress: (p) => [p.stats.maxCombo, 15] },
  { id: 'length30', name: 'Длинная история', desc: 'Вырасти до длины 30', sprite: 'snake', reward: 80, check: (p) => p.stats.maxLength >= 30, progress: (p) => [p.stats.maxLength, 30] },
  { id: 'length60', name: 'Анаконда', desc: 'Вырасти до длины 60', sprite: 'medal', reward: 220, check: (p) => p.stats.maxLength >= 60, progress: (p) => [p.stats.maxLength, 60] },
  { id: 'golden5', name: 'Золотоискатель', desc: 'Съешь 5 золотых яблок', sprite: 'coin', reward: 60, check: (p) => p.stats.goldens >= 5, progress: (p) => [p.stats.goldens, 5] },
  {
    id: 'allpowers', name: 'Коллекционер', desc: 'Подбери каждый из 6 бонусов', sprite: 'gift', reward: 120,
    check: (p) => POWER_LIST.every((pw) => (p.stats.powers[pw.id] ?? 0) > 0),
    progress: (p) => [POWER_LIST.filter((pw) => (p.stats.powers[pw.id] ?? 0) > 0).length, 6],
  },
  { id: 'portal50', name: 'Телепортёр', desc: 'Пройди через порталы 50 раз', sprite: 'dizzy', reward: 80, check: (p) => p.stats.portals >= 50, progress: (p) => [p.stats.portals, 50] },
  { id: 'shield', name: 'Спасён!', desc: 'Щит спас тебя от удара', sprite: 'shield', reward: 40, check: (p) => p.stats.shieldsSaved >= 1 },
  { id: 'arenawin', name: 'Царь арены', desc: 'Победи в арене', sprite: 'crown', reward: 120, check: (p) => p.stats.arenaWins >= 1 },
  { id: 'kills10', name: 'Хищник', desc: 'Съешь 10 соперников в арене', sprite: 'skull', reward: 100, check: (p) => p.stats.kills >= 10, progress: (p) => [p.stats.kills, 10] },
  { id: 'duel', name: 'Дружеский матч', desc: 'Сыграй дуэль вдвоём', sprite: 'gamepad', reward: 40, check: (p) => p.stats.duels >= 1 },
  { id: 'blitz600', name: 'Молния', desc: 'Набери 600 очков в Блице', sprite: 'bolt', reward: 100, check: (p) => (p.best.blitz ?? 0) >= 600, progress: (p) => [p.best.blitz ?? 0, 600] },
  { id: 'campaign5', name: 'Путешественник', desc: 'Пройди 5 уровней приключения', sprite: 'map', reward: 80, check: (p) => campaignDone(p) >= 5, progress: (p) => [campaignDone(p), 5] },
  { id: 'campaignAll', name: 'Легенда', desc: 'Пройди всё приключение', sprite: 'trophy', reward: 300, check: (p) => campaignDone(p) >= LEVELS.length, progress: (p) => [campaignDone(p), LEVELS.length] },
  { id: 'stars45', name: 'Перфекционист', desc: 'Собери все 45 звёзд', sprite: 'star', reward: 500, check: (p) => campaignStars(p) >= LEVELS.length * 3, progress: (p) => [campaignStars(p), LEVELS.length * 3] },
  { id: 'daily', name: 'Испытатель', desc: 'Пройди испытание дня', sprite: 'calendar', reward: 60, check: (p) => p.stats.dailyWins >= 1 },
  { id: 'blender', name: 'Блендер', desc: 'Сыграй классику с 3+ модификаторами', sprite: 'cyclone', reward: 60, check: (p) => p.stats.blenderGames >= 1 },
  { id: 'shop', name: 'Модник', desc: 'Купи первую вещь в магазине', sprite: 'bags', reward: 30, check: (p) => p.stats.purchases >= 1 },
  { id: 'collector', name: 'Стилист', desc: 'Собери 10 вещей', sprite: 'sparkles', reward: 150, check: (p) => ownedCount(p) >= 10, progress: (p) => [ownedCount(p), 10] },
  { id: 'wheel', name: 'Везунчик', desc: 'Крутани колесо удачи', sprite: 'slot', reward: 20, check: (p) => p.stats.spins >= 1 },
  { id: 'level10', name: 'Опытный', desc: 'Достигни 10 уровня', sprite: 'medal1', reward: 200, check: (p) => levelInfo(p.xp).level >= 10, progress: (p) => [levelInfo(p.xp).level, 10] },
];

/** Unlocks newly satisfied achievements inside a draft; returns them. */
function unlockAchievements(p: Profile): AchievementDef[] {
  const out: AchievementDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!p.achievements[a.id] && a.check(p)) {
      p.achievements[a.id] = Date.now();
      p.coins += a.reward;
      out.push(a);
    }
  }
  return out;
}

// ─── Daily quests ───────────────────────────────────────────────────────────

interface QuestDef {
  id: string;
  sprite: string;
  targets: number[];
  reward: number;
  text: (n: number) => string;
  kind: 'sum' | 'max';
  metric: (r: RunResult) => number;
}

export const QUESTS: QuestDef[] = [
  { id: 'fruits', sprite: 'apple', targets: [30, 50, 80], reward: 60, kind: 'sum', text: (n) => `Съешь ${n} фруктов`, metric: (r) => r.fruits },
  { id: 'combo', sprite: 'fire', targets: [5, 7, 10], reward: 80, kind: 'max', text: (n) => `Сделай комбо из ${n} фруктов`, metric: (r) => r.maxCombo },
  { id: 'score', sprite: 'hundred', targets: [300, 500, 800], reward: 80, kind: 'max', text: (n) => `Набери ${n} очков за игру`, metric: (r) => (r.mode === 'duel' ? 0 : r.score) },
  { id: 'powers', sprite: 'gift', targets: [3, 5, 8], reward: 70, kind: 'sum', text: (n) => `Подбери ${n} бонусов`, metric: (r) => Object.values(r.powers).reduce((a, b) => a + (b ?? 0), 0) },
  { id: 'arena', sprite: 'swords', targets: [1], reward: 120, kind: 'sum', text: () => 'Победи в арене', metric: (r) => (r.mode === 'arena' && r.win ? 1 : 0) },
  { id: 'kills', sprite: 'skull', targets: [2, 4], reward: 90, kind: 'sum', text: (n) => `Съешь ${n} змеек в арене`, metric: (r) => (r.mode === 'arena' ? r.kills : 0) },
  { id: 'blitz', sprite: 'bolt', targets: [250, 400, 600], reward: 90, kind: 'max', text: (n) => `Набери ${n} очков в Блице`, metric: (r) => (r.mode === 'blitz' ? r.score : 0) },
  { id: 'games', sprite: 'gamepad', targets: [3, 5, 7], reward: 50, kind: 'sum', text: (n) => `Сыграй ${n} игр`, metric: () => 1 },
  { id: 'goldens', sprite: 'coin', targets: [1, 2, 3], reward: 70, kind: 'sum', text: (n) => `Съешь ${n} золот${n === 1 ? 'ое яблоко' : 'ых яблока'}`, metric: (r) => r.goldens },
  { id: 'stars', sprite: 'star', targets: [3, 6], reward: 90, kind: 'sum', text: (n) => `Собери ${n} звёзд в приключении`, metric: (r) => r.stars },
  { id: 'length', sprite: 'snake', targets: [15, 22, 30], reward: 70, kind: 'max', text: (n) => `Вырасти до длины ${n}`, metric: (r) => (r.mode === 'duel' ? 0 : r.length) },
  { id: 'portals', sprite: 'dizzy', targets: [5, 10], reward: 60, kind: 'sum', text: (n) => `Пройди через портал ${n} раз`, metric: (r) => r.portals },
];

export const questDef = (id: string) => QUESTS.find((q) => q.id === id)!;

function ensureQuests(p: Profile) {
  const today = todayKey();
  if (p.quests.date === today && p.quests.list.length) return;
  const rng = new Rng(hashString('quests' + today));
  const picks = rng.shuffle([...QUESTS]).slice(0, 3);
  p.quests = {
    date: today,
    list: picks.map((q) => {
      const ti = rng.int(q.targets.length);
      return { id: q.id, target: q.targets[ti], progress: 0, reward: q.reward + ti * 30, claimed: false };
    }),
  };
}

export function refreshDaily() {
  const today = todayKey();
  if (state.quests.date !== today || state.daily.date !== today) {
    setProfile((p) => {
      ensureQuests(p);
      if (p.daily.date !== today) p.daily = { date: today, best: 0, rewarded: false };
    });
  }
}

export function claimQuest(index: number): number {
  let reward = 0;
  setProfile((p) => {
    const q = p.quests.list[index];
    if (!q || q.claimed || q.progress < q.target) return;
    q.claimed = true;
    p.coins += q.reward;
    p.stats.coinsEarned += q.reward;
    reward = q.reward;
  });
  return reward;
}

// ─── Run results ────────────────────────────────────────────────────────────

export interface RunReward {
  coins: number;
  xp: number;
  levelUp: number | null;
  achievements: AchievementDef[];
  quests: string[];
  newBest: boolean;
  prevBest: number;
  newStars: number;
  breakdown: { label: string; value: number }[];
}

export function applyRun(run: RunResult): RunReward {
  const reward: RunReward = { coins: 0, xp: 0, levelUp: null, achievements: [], quests: [], newBest: false, prevBest: 0, newStars: 0, breakdown: [] };

  setProfile((p) => {
    ensureQuests(p);
    const s = p.stats;
    s.games++;
    s.fruits += run.fruits;
    s.maxCombo = Math.max(s.maxCombo, run.maxCombo);
    s.maxLength = Math.max(s.maxLength, run.mode === 'duel' ? 0 : run.length);
    s.portals += run.portals;
    s.goldens += run.goldens;
    s.shieldsSaved += run.shieldsSaved;
    s.playTimeMs += run.timeMs;
    for (const [k, v] of Object.entries(run.powers)) s.powers[k as PowerId] = (s.powers[k as PowerId] ?? 0) + (v ?? 0);
    if (run.mode !== 'duel' && run.mode !== 'campaign') s.bestScore = Math.max(s.bestScore, run.score);
    if (run.mode === 'arena') {
      s.kills += run.kills;
      if (run.win) s.arenaWins++;
    }
    if (run.mode === 'duel') s.duels++;
    if (run.mode === 'classic' && run.mutators.length >= 3) s.blenderGames++;

    const add = (label: string, value: number) => {
      if (value <= 0) return;
      reward.breakdown.push({ label, value });
      reward.coins += value;
    };

    // Best scores & history.
    const bestKey = run.mode === 'daily' ? `daily:${todayKey()}` : run.mode;
    if (run.mode !== 'duel' && run.mode !== 'campaign') {
      reward.prevBest = p.best[bestKey] ?? 0;
      if (run.score > reward.prevBest) {
        p.best[bestKey] = run.score;
        reward.newBest = reward.prevBest > 0 || run.score > 0;
      }
      const hist = p.history[run.mode] ?? [];
      hist.push({ score: run.score, date: new Date().toISOString() });
      hist.sort((a, b) => b.score - a.score);
      p.history[run.mode] = hist.slice(0, 10);
    }

    add('Очки', run.mode === 'duel' ? 15 : Math.floor(run.score / 15));
    add('Монетки на поле', run.coinsPicked * 3);

    if (run.mode === 'campaign' && run.levelId && run.win) {
      const prev = p.campaign[run.levelId] ?? 0;
      if (run.stars > prev) {
        reward.newStars = run.stars - prev;
        p.campaign[run.levelId] = run.stars;
        add('Новые звёзды', reward.newStars * 25);
      }
      if (prev === 0) add('Уровень пройден', 40);
    }
    if (run.mode === 'arena') add(run.rank === 1 ? 'Победа в арене' : `Место #${run.rank}`, [0, 100, 40, 15][run.rank] ?? 0);
    if (run.mode === 'daily') {
      p.daily.best = Math.max(p.daily.best, run.score);
      if (run.win && !p.daily.rewarded) {
        p.daily.rewarded = true;
        s.dailyWins++;
        add('Испытание дня', 150);
      }
    }

    reward.xp = Math.round(20 + run.score / 4 + run.stars * 15 + (run.win ? 25 : 0));
    const before = levelInfo(p.xp).level;
    p.xp += reward.xp;
    const after = levelInfo(p.xp).level;
    if (after > before) {
      reward.levelUp = after;
      add(`Уровень ${after}`, 50 + after * 10);
    }

    // Quests.
    for (const q of p.quests.list) {
      if (q.claimed || q.progress >= q.target) continue;
      const def = questDef(q.id);
      const m = def.metric(run);
      q.progress = def.kind === 'sum' ? q.progress + m : Math.max(q.progress, m);
      if (q.progress >= q.target) {
        q.progress = q.target;
        reward.quests.push(q.id);
      }
    }

    p.coins += reward.coins;
    s.coinsEarned += reward.coins;
    reward.achievements = unlockAchievements(p);
    if (!p.tutorialSeen) p.tutorialSeen = true;
  });

  return reward;
}

// ─── Shop / wheel ───────────────────────────────────────────────────────────

export type ShopKind = 'skins' | 'hats' | 'themes';

export function priceOf(kind: ShopKind, id: string) {
  const list = kind === 'skins' ? SKINS : kind === 'hats' ? HATS : THEMES;
  return list.find((i) => i.id === id)?.price ?? 0;
}

export function buy(kind: ShopKind, id: string): { ok: boolean; achievements: AchievementDef[] } {
  let ok = false;
  let achievements: AchievementDef[] = [];
  setProfile((p) => {
    const price = priceOf(kind, id);
    if (p.owned[kind].includes(id) || p.coins < price) return;
    p.coins -= price;
    p.owned[kind].push(id);
    p.stats.purchases++;
    const slot = kind === 'skins' ? 'skin' : kind === 'hats' ? 'hat' : 'theme';
    p.equipped[slot] = id;
    ok = true;
    achievements = unlockAchievements(p);
  });
  return { ok, achievements };
}

export function equip(kind: ShopKind, id: string) {
  setProfile((p) => {
    if (!p.owned[kind].includes(id)) return;
    const slot = kind === 'skins' ? 'skin' : kind === 'hats' ? 'hat' : 'theme';
    p.equipped[slot] = id;
  });
}

export interface WheelPrize {
  label: string;
  sprite: string;
  coins: number;
  color: string;
  weight: number;
  item?: boolean;
}

export const WHEEL: WheelPrize[] = [
  { label: '25', sprite: 'coin', coins: 25, color: '#38bdf8', weight: 22 },
  { label: '50', sprite: 'coin', coins: 50, color: '#a78bfa', weight: 20 },
  { label: '100', sprite: 'moneybag', coins: 100, color: '#f472b6', weight: 14 },
  { label: '40', sprite: 'coin', coins: 40, color: '#34d399', weight: 20 },
  { label: '250', sprite: 'gem', coins: 250, color: '#fbbf24', weight: 6 },
  { label: 'Вещь', sprite: 'gift', coins: 0, color: '#fb7185', weight: 8, item: true },
  { label: '75', sprite: 'coin', coins: 75, color: '#60a5fa', weight: 14 },
  { label: '500', sprite: 'crown', coins: 500, color: '#f97316', weight: 2 },
];

export const SPIN_PRICE = 120;

export function canSpinFree(p: Profile) {
  return p.wheel.lastFree !== todayKey();
}

export function spinWheel(): { index: number; prize: WheelPrize; itemName?: string; achievements: AchievementDef[] } | null {
  const p0 = getProfile();
  const free = canSpinFree(p0);
  if (!free && p0.coins < SPIN_PRICE) return null;
  const total = WHEEL.reduce((a, w) => a + w.weight, 0);
  let roll = Math.random() * total;
  let index = 0;
  for (let i = 0; i < WHEEL.length; i++) {
    roll -= WHEEL[i].weight;
    if (roll <= 0) { index = i; break; }
  }
  const prize = WHEEL[index];
  let itemName: string | undefined;
  let achievements: AchievementDef[] = [];
  setProfile((p) => {
    if (free) p.wheel.lastFree = todayKey();
    else p.coins -= SPIN_PRICE;
    p.stats.spins++;
    if (prize.item) {
      const lockedSkins = SKINS.filter((s) => !p.owned.skins.includes(s.id) && s.price <= 600);
      const lockedHats = HATS.filter((h) => !p.owned.hats.includes(h.id) && h.price <= 600);
      const pool = [...lockedSkins.map((s) => ({ kind: 'skins' as const, id: s.id, name: `Скин «${s.name}»` })), ...lockedHats.map((h) => ({ kind: 'hats' as const, id: h.id, name: `Шляпа «${h.name}»` }))];
      if (pool.length) {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        p.owned[pick.kind].push(pick.id);
        itemName = pick.name;
      } else {
        p.coins += 300;
        itemName = '300 монет';
      }
    } else {
      p.coins += prize.coins;
      p.stats.coinsEarned += prize.coins;
    }
    achievements = unlockAchievements(p);
  });
  return { index, prize, itemName, achievements };
}

export function modeBest(p: Profile, mode: ModeId) {
  return p.best[mode === 'daily' ? `daily:${todayKey()}` : mode] ?? 0;
}
