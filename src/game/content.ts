import type { MutatorId, PowerId } from './types';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RARITY: Record<Rarity, { label: string; color: string }> = {
  common: { label: 'Обычный', color: '#94a3b8' },
  rare: { label: 'Редкий', color: '#38bdf8' },
  epic: { label: 'Эпический', color: '#c084fc' },
  legendary: { label: 'Легендарный', color: '#fbbf24' },
};

// ─── Snake skins ────────────────────────────────────────────────────────────

export interface SkinDef {
  id: string;
  name: string;
  price: number;
  rarity: Rarity;
  outline: string;
  glow?: string;
  /** Colour of segment sample `i` (0 = head) for a snake of `len` segments at time `t` (seconds). */
  color: (i: number, len: number, t: number) => string;
  preview: [string, string];
}

const alt = (a: string, b: string, every: number) => (i: number) => (Math.floor(i / every) % 2 === 0 ? a : b);

export const SKINS: SkinDef[] = [
  {
    id: 'emerald', name: 'Изумруд', price: 0, rarity: 'common', outline: '#166534',
    color: (i) => (Math.floor(i / 2) % 2 === 0 ? '#4ade80' : '#3ecf74'), preview: ['#4ade80', '#22c55e'],
  },
  {
    id: 'ocean', name: 'Океан', price: 150, rarity: 'common', outline: '#1e3a8a',
    color: (i, len) => `hsl(${205 + (i / Math.max(len, 1)) * 30}, 90%, ${62 - (i / Math.max(len, 1)) * 14}%)`, preview: ['#38bdf8', '#2563eb'],
  },
  {
    id: 'sunset', name: 'Закат', price: 200, rarity: 'common', outline: '#9a3412',
    color: (i, len) => `hsl(${35 - (i / Math.max(len, 1)) * 45}, 95%, 60%)`, preview: ['#fb923c', '#ec4899'],
  },
  {
    id: 'bee', name: 'Пчёлка', price: 250, rarity: 'common', outline: '#422006',
    color: alt('#facc15', '#292524', 4), preview: ['#facc15', '#292524'],
  },
  {
    id: 'candy', name: 'Леденец', price: 300, rarity: 'rare', outline: '#9d174d',
    color: alt('#fbcfe8', '#f43f5e', 3), preview: ['#fbcfe8', '#f43f5e'],
  },
  {
    id: 'tiger', name: 'Тигр', price: 350, rarity: 'rare', outline: '#431407',
    color: (i) => (i % 7 < 2 && i > 3 ? '#1c1917' : '#f97316'), preview: ['#f97316', '#1c1917'],
  },
  {
    id: 'zebra', name: 'Зебра', price: 350, rarity: 'rare', outline: '#0a0a0a',
    color: alt('#fafafa', '#262626', 3), preview: ['#fafafa', '#262626'],
  },
  {
    id: 'watermelon', name: 'Арбуз', price: 400, rarity: 'rare', outline: '#14532d',
    color: (i) => (i < 4 ? '#f43f5e' : i % 6 < 3 ? '#16a34a' : '#86efac'), preview: ['#16a34a', '#f43f5e'],
  },
  {
    id: 'neon', name: 'Неон', price: 550, rarity: 'epic', outline: '#22d3ee', glow: '#22d3ee',
    color: (i, _l, t) => (Math.floor(i / 3 + t * 6) % 4 === 0 ? '#67e8f9' : '#0e1726'), preview: ['#0e1726', '#22d3ee'],
  },
  {
    id: 'lava', name: 'Лава', price: 600, rarity: 'epic', outline: '#450a0a', glow: '#f97316',
    color: (i, _l, t) => `hsl(${10 + Math.sin(i * 0.7 + t * 5) * 18 + 12}, 100%, ${48 + Math.sin(i * 1.3 - t * 7) * 10}%)`,
    preview: ['#ef4444', '#fbbf24'],
  },
  {
    id: 'ghostly', name: 'Призрак', price: 650, rarity: 'epic', outline: '#6366f1', glow: '#a5b4fc',
    color: (i, _l, t) => `hsla(${230 + Math.sin(i * 0.4 + t * 2) * 20}, 100%, 88%, 0.9)`, preview: ['#e0e7ff', '#818cf8'],
  },
  {
    id: 'rainbow', name: 'Радуга', price: 900, rarity: 'legendary', outline: '#312e81',
    color: (i, _l, t) => `hsl(${(i * 14 - t * 120) % 360}, 95%, 62%)`, preview: ['#f43f5e', '#8b5cf6'],
  },
  {
    id: 'galaxy', name: 'Галактика', price: 1100, rarity: 'legendary', outline: '#1e1b4b', glow: '#a78bfa',
    color: (i, _l, t) => {
      const twinkle = Math.sin(i * 12.9898 + Math.floor(t * 3) * 78.233) > 0.93;
      return twinkle ? '#fef9c3' : `hsl(${260 + Math.sin(i * 0.25 + t) * 30}, 70%, ${26 + Math.sin(i * 0.5) * 6}%)`;
    },
    preview: ['#4c1d95', '#1e1b4b'],
  },
  {
    id: 'gold', name: 'Золото', price: 1500, rarity: 'legendary', outline: '#713f12', glow: '#fde047',
    color: (i, _l, t) => `hsl(45, 95%, ${52 + Math.max(0, Math.sin(i * 0.35 - t * 6)) * 26}%)`, preview: ['#fde047', '#ca8a04'],
  },
];

export const skinById = (id: string) => SKINS.find((s) => s.id === id) ?? SKINS[0];

// ─── Hats ───────────────────────────────────────────────────────────────────

export interface HatDef {
  id: string;
  name: string;
  price: number;
  rarity: Rarity;
  sprite: string;
  /** Where it sits: 'top' of the head or over the 'eyes'. */
  place: 'top' | 'eyes';
  scale: number;
}

export const HATS: HatDef[] = [
  { id: 'none', name: 'Без шляпы', price: 0, rarity: 'common', sprite: '', place: 'top', scale: 1 },
  { id: 'blossom', name: 'Цветочек', price: 150, rarity: 'common', sprite: 'blossom', place: 'top', scale: 0.7 },
  { id: 'cap', name: 'Кепка', price: 200, rarity: 'common', sprite: 'cap', place: 'top', scale: 0.95 },
  { id: 'ribbon', name: 'Бантик', price: 250, rarity: 'common', sprite: 'ribbon', place: 'top', scale: 0.8 },
  { id: 'helmet', name: 'Каска', price: 300, rarity: 'rare', sprite: 'helmet', place: 'top', scale: 0.95 },
  { id: 'sunglasses', name: 'Очки', price: 350, rarity: 'rare', sprite: 'sunglasses', place: 'eyes', scale: 0.95 },
  { id: 'headphone', name: 'Наушники', price: 400, rarity: 'rare', sprite: 'headphone', place: 'top', scale: 1.05 },
  { id: 'tophat', name: 'Цилиндр', price: 500, rarity: 'epic', sprite: 'tophat', place: 'top', scale: 1 },
  { id: 'womanshat', name: 'Шляпка', price: 500, rarity: 'epic', sprite: 'womanshat', place: 'top', scale: 1.05 },
  { id: 'gradcap', name: 'Магистр', price: 600, rarity: 'epic', sprite: 'gradcap', place: 'top', scale: 1 },
  { id: 'crown', name: 'Корона', price: 1200, rarity: 'legendary', sprite: 'crown', place: 'top', scale: 0.95 },
];

export const hatById = (id: string) => HATS.find((h) => h.id === id) ?? HATS[0];

// ─── Board themes ───────────────────────────────────────────────────────────

export interface ThemeDef {
  id: string;
  name: string;
  price: number;
  rarity: Rarity;
  icon: string;
  tileA: string;
  tileB: string;
  frame: string;
  frameLight: string;
  bgTop: string;
  bgBottom: string;
  decor: string[];
  decorAlpha: number;
  grid?: string;
  stars?: boolean;
  rock: string;
}

export const THEMES: ThemeDef[] = [
  {
    id: 'meadow', name: 'Луг', price: 0, rarity: 'common', icon: 'clover',
    tileA: '#aad751', tileB: '#a2d149', frame: '#4a752c', frameLight: '#578a34',
    bgTop: '#1e3a2a', bgBottom: '#0f1f17', decor: ['#8cc63f', '#b8e068', '#fff7ae'], decorAlpha: 0.5, rock: 'rock',
  },
  {
    id: 'desert', name: 'Пустыня', price: 300, rarity: 'common', icon: 'cactus',
    tileA: '#f4d58d', tileB: '#ecca7c', frame: '#b7791f', frameLight: '#d69e2e',
    bgTop: '#4a2c14', bgBottom: '#24150a', decor: ['#e2b664', '#fbe3a8'], decorAlpha: 0.6, rock: 'rock',
  },
  {
    id: 'ice', name: 'Льдина', price: 400, rarity: 'rare', icon: 'snowflake',
    tileA: '#dbeafe', tileB: '#cfe2fb', frame: '#3b82f6', frameLight: '#60a5fa',
    bgTop: '#172554', bgBottom: '#0b1330', decor: ['#ffffff', '#bfdbfe'], decorAlpha: 0.7, rock: 'ice',
  },
  {
    id: 'candy', name: 'Сладкое', price: 500, rarity: 'rare', icon: 'lollipop',
    tileA: '#fce7f3', tileB: '#fbcfe8', frame: '#db2777', frameLight: '#ec4899',
    bgTop: '#500724', bgBottom: '#2a0415', decor: ['#f9a8d4', '#c4b5fd', '#99f6e4'], decorAlpha: 0.7, rock: 'candy',
  },
  {
    id: 'neon', name: 'Неон', price: 650, rarity: 'epic', icon: 'cityscape',
    tileA: '#10102a', tileB: '#0d0d22', frame: '#d946ef', frameLight: '#f0abfc',
    bgTop: '#1e0a3c', bgBottom: '#07030f', decor: [], decorAlpha: 0, grid: 'rgba(217,70,239,0.18)', rock: 'rock',
  },
  {
    id: 'space', name: 'Космос', price: 800, rarity: 'epic', icon: 'planet',
    tileA: '#1c1640', tileB: '#191338', frame: '#6d28d9', frameLight: '#8b5cf6',
    bgTop: '#0f0a24', bgBottom: '#040210', decor: ['#ffffff', '#c4b5fd', '#fde68a'], decorAlpha: 0.9, stars: true, rock: 'planet',
  },
  {
    id: 'volcano', name: 'Вулкан', price: 900, rarity: 'legendary', icon: 'volcano',
    tileA: '#3b2a2a', tileB: '#342424', frame: '#dc2626', frameLight: '#f97316',
    bgTop: '#2a0a05', bgBottom: '#0f0302', decor: ['#f97316', '#fbbf24'], decorAlpha: 0.35, rock: 'rock',
  },
];

export const themeById = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0];

// ─── Items ──────────────────────────────────────────────────────────────────

export const FRUITS = ['apple', 'tangerine', 'grapes', 'strawberry', 'banana', 'cherries', 'watermelon', 'peach', 'pineapple', 'kiwi', 'lemon', 'blueberries'];

export interface PowerDef {
  id: PowerId;
  name: string;
  sprite: string;
  color: string;
  durationMs: number;
  desc: string;
}

export const POWERS: Record<PowerId, PowerDef> = {
  turbo: { id: 'turbo', name: 'Турбо', sprite: 'bolt', color: '#facc15', durationMs: 6000, desc: 'Скорость и двойные очки' },
  freeze: { id: 'freeze', name: 'Заморозка', sprite: 'snowflake', color: '#7dd3fc', durationMs: 6000, desc: 'Всё вокруг замедляется' },
  magnet: { id: 'magnet', name: 'Магнит', sprite: 'magnet', color: '#f87171', durationMs: 8000, desc: 'Притягивает еду' },
  ghost: { id: 'ghost', name: 'Призрак', sprite: 'ghost', color: '#c4b5fd', durationMs: 6000, desc: 'Проходишь сквозь всё' },
  shield: { id: 'shield', name: 'Щит', sprite: 'shield', color: '#60a5fa', durationMs: 0, desc: 'Спасает от одного удара' },
  scissors: { id: 'scissors', name: 'Ножницы', sprite: 'scissors', color: '#f472b6', durationMs: 0, desc: 'Отрезает полхвоста за очки' },
};

export const POWER_LIST = Object.values(POWERS);

// ─── Mutators (a la Google Snake "blender") ────────────────────────────────

export interface MutatorDef {
  id: MutatorId;
  name: string;
  sprite: string;
  desc: string;
  bonus: number;
}

export const MUTATORS: MutatorDef[] = [
  { id: 'wrap', name: 'Без границ', sprite: 'cyclone', desc: 'Проходишь сквозь стены на другую сторону', bonus: -0.2 },
  { id: 'walls', name: 'Камнепад', sprite: 'rock', desc: 'Каждый фрукт роняет на поле камень', bonus: 0.4 },
  { id: 'portals', name: 'Порталы', sprite: 'dizzy', desc: 'Пары порталов телепортируют змейку', bonus: 0.1 },
  { id: 'poison', name: 'Мухоморы', sprite: 'mushroom', desc: 'Ядовитый гриб переворачивает управление', bonus: 0.3 },
  { id: 'cheese', name: 'Сыр', sprite: 'ghost', desc: 'Можно проползать сквозь себя', bonus: -0.3 },
  { id: 'dark', name: 'Ночь', sprite: 'milkyway', desc: 'Видно только вокруг головы', bonus: 0.5 },
  { id: 'feast', name: 'Пир', sprite: 'party', desc: 'На поле сразу пять фруктов', bonus: -0.1 },
  { id: 'turbo', name: 'Разгон', sprite: 'rocket', desc: 'Каждый фрукт ускоряет змейку', bonus: 0.5 },
];

export const mutatorById = (id: MutatorId) => MUTATORS.find((m) => m.id === id)!;

// ─── Speeds / sizes ─────────────────────────────────────────────────────────

export const SPEEDS = [
  { id: 'slow', name: 'Спокойно', ms: 165, mult: 0.8, sprite: 'snail' },
  { id: 'normal', name: 'Нормально', ms: 125, mult: 1, sprite: 'snake' },
  { id: 'fast', name: 'Быстро', ms: 95, mult: 1.3, sprite: 'bolt' },
  { id: 'insane', name: 'Безумно', ms: 68, mult: 1.7, sprite: 'fire' },
] as const;

export const SIZES = [
  { id: 's', name: 'Малое', cols: 13, rows: 11 },
  { id: 'm', name: 'Среднее', cols: 17, rows: 15 },
  { id: 'l', name: 'Большое', cols: 23, rows: 19 },
] as const;

export const BOT_NAMES = ['Шипучка', 'Удав Петрович', 'Кобра', 'Питоша', 'Гадюка', 'Червячок', 'Анаконда', 'Медянка', 'Полоз', 'Мамба'];
