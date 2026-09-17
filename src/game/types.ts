export type Dir = 0 | 1 | 2 | 3; // up, right, down, left
export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;
export const opposite = (d: Dir): Dir => ((d + 2) % 4) as Dir;

export interface Vec {
  x: number;
  y: number;
}

export type ModeId = 'classic' | 'campaign' | 'arena' | 'blitz' | 'duel' | 'daily' | 'demo';

export type MutatorId = 'wrap' | 'walls' | 'portals' | 'poison' | 'cheese' | 'dark' | 'feast' | 'turbo';

export type PowerId = 'turbo' | 'freeze' | 'magnet' | 'ghost' | 'shield' | 'scissors';

export type ItemKind = 'fruit' | 'golden' | 'poison' | 'clock' | 'coin' | 'power' | 'key' | 'orb';

export interface Item {
  id: number;
  kind: ItemKind;
  x: number;
  y: number;
  sprite: string;
  power?: PowerId;
  value: number;
  /** Remaining lifetime in ms, if the item expires. */
  ttl?: number;
  maxTtl?: number;
  born: number;
  color?: string;
  /** Magnet pull accumulator. */
  pull?: number;
}

export interface Portal {
  a: Vec;
  b: Vec;
  color: string;
}

export type Controller = 'p1' | 'p2' | 'bot';

export interface Snake {
  id: number;
  name: string;
  controller: Controller;
  body: Vec[];
  prevBody: Vec[];
  dir: Dir;
  queue: Dir[];
  alive: boolean;
  skin: string;
  hat: string;
  grow: number;
  score: number;
  fruits: number;
  kills: number;
  /** Active timed powers, ms remaining. */
  effects: Partial<Record<PowerId, number>>;
  shield: boolean;
  reversed: number;
  moveAcc: number;
  stepMs: number;
  boosting: boolean;
  boostSteps: number;
  /** Positions (in segments from the head) of swallowed-food bulges. */
  gulps: number[];
  combo: number;
  comboTimer: number;
  maxCombo: number;
  deadTime: number;
  respawnIn: number;
  invuln: number;
  botLevel: number;
  /** Jumps between prevBody and body (portal / wrap) that should not be interpolated. */
  teleported: boolean;
  wrapped: boolean;
}

export type GameEvent =
  | { type: 'eat'; snake: number; x: number; y: number; points: number; combo: number; kind: ItemKind; sprite: string; power?: PowerId }
  | { type: 'die'; snake: number; x: number; y: number; by?: number; reason: string }
  | { type: 'kill'; snake: number; victim: number }
  | { type: 'shield'; snake: number; x: number; y: number }
  | { type: 'portal'; snake: number; x: number; y: number; x2: number; y2: number }
  | { type: 'powerEnd'; snake: number; power: PowerId }
  | { type: 'unlock'; x: number; y: number }
  | { type: 'rock'; x: number; y: number }
  | { type: 'respawn'; snake: number }
  | { type: 'timeUp' }
  | { type: 'round'; winner: number | null }
  | { type: 'win' }
  | { type: 'boostDrop'; snake: number };

export type Phase = 'countdown' | 'playing' | 'paused' | 'roundOver' | 'dying' | 'over';

export interface RunResult {
  mode: ModeId;
  win: boolean;
  score: number;
  length: number;
  fruits: number;
  timeMs: number;
  maxCombo: number;
  kills: number;
  coinsPicked: number;
  goldens: number;
  powers: Partial<Record<PowerId, number>>;
  portals: number;
  shieldsSaved: number;
  stars: number;
  rank: number;
  levelId?: number;
  mutators: MutatorId[];
  duelWinner?: number | null;
  duelScore?: [number, number];
  reason: string;
}
