import { Rng } from './rng';
import { BOT_NAMES, FRUITS, POWERS, POWER_LIST, SKINS, HATS } from './content';
import type { LevelDef } from './levels';
import { starsFor } from './levels';
import { decideBotMove } from './ai';
import {
  DX,
  DY,
  opposite,
  type Controller,
  type Dir,
  type GameEvent,
  type Item,
  type ItemKind,
  type ModeId,
  type MutatorId,
  type Phase,
  type Portal,
  type PowerId,
  type RunResult,
  type Snake,
  type Vec,
} from './types';

export interface GameConfig {
  mode: ModeId;
  cols: number;
  rows: number;
  stepMs: number;
  scoreMult: number;
  mutators: MutatorId[];
  wrap: boolean;
  powerups: boolean;
  fruitCount: number;
  timeLimitMs?: number;
  bots?: { count: number; level: number };
  duelRounds?: number;
  level?: LevelDef;
  /** Swap rows/cols (portrait screens). */
  transpose?: boolean;
  seed: number;
  skin: string;
  hat: string;
  p2Skin?: string;
  goalScore?: number;
  countdown?: boolean;
  /**
   * Commit a queued turn immediately when the snake is early in its cell,
   * repaying the borrowed time on the following step. On by default; the demo
   * background and the unit tests pin it explicitly.
   */
  earlyTurn?: boolean;
}

/**
 * A turn issued in the first 45% of a cell traversal is committed on the spot.
 * Later than that and the snake is close enough to the boundary that the wait
 * is imperceptible anyway.
 */
export const EARLY_TURN_FRAC = 0.45;

export const CELL_EMPTY = 0;
export const CELL_ROCK = 1;
export const CELL_LOCK = 2;

const PORTAL_COLORS = ['#a855f7', '#06b6d4', '#f59e0b'];

export class Engine {
  cfg: GameConfig;
  rng: Rng;
  cols = 0;
  rows = 0;
  cells!: Uint8Array;
  /** Cells reachable from the start (items only spawn there). */
  reachable!: Uint8Array;
  items: Item[] = [];
  portals: Portal[] = [];
  snakes: Snake[] = [];
  phase: Phase = 'countdown';
  countdownMs = 3000;
  time = 0;
  timeLeft = 0;
  events: GameEvent[] = [];
  result: RunResult | null = null;
  mutators: Set<MutatorId>;
  wrap: boolean;

  goal = 0;
  rivalId = -1;
  duelWins: [number, number] = [0, 0];
  round = 1;
  roundTimer = 0;
  lastRoundWinner: number | null = null;
  dyingTimer = 0;
  pendingWin = false;
  pendingReason = '';

  stats = { portals: 0, shieldsSaved: 0, goldens: 0, coins: 0, powers: {} as Partial<Record<PowerId, number>> };

  private nextId = 1;
  private goldenTimer = 0;
  private powerTimer = 0;
  private coinTimer = 0;
  private clockTimer = 0;
  private startCells: { pos: Vec; dir: Dir; kind: 'player' | 'rival' }[] = [];

  constructor(cfg: GameConfig) {
    this.cfg = cfg;
    this.rng = new Rng(cfg.seed);
    this.mutators = new Set([...(cfg.mutators ?? []), ...(cfg.level?.mutators ?? [])]);
    this.wrap = cfg.wrap || !!cfg.level?.wrap || this.mutators.has('wrap');
    this.timeLeft = cfg.timeLimitMs ?? 0;
    this.countdownMs = cfg.countdown === false ? 0 : 3000;
    this.phase = this.countdownMs > 0 ? 'countdown' : 'playing';
    this.buildBoard();
    this.spawnSnakes();
    this.computeReachable();
    if (this.mutators.has('portals') && this.portals.length === 0) {
      for (let k = 0; k < 2; k++) this.placeRandomPortal(k);
    }
    this.resetTimers();
    this.fillItems();
  }

  // ─── Setup ──────────────────────────────────────────────────────────────

  private buildBoard() {
    const { cfg } = this;
    const level = cfg.level;
    if (level) {
      const h = level.map.length;
      const w = level.map[0].length;
      this.cols = cfg.transpose ? h : w;
      this.rows = cfg.transpose ? w : h;
      this.goal = level.goal;
    } else {
      this.cols = cfg.transpose ? cfg.rows : cfg.cols;
      this.rows = cfg.transpose ? cfg.cols : cfg.rows;
    }
    this.cells = new Uint8Array(this.cols * this.rows);

    if (level) {
      const pairs: Record<string, { a?: Vec; b?: Vec }> = {};
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          const ch = cfg.transpose ? level.map[x][y] : level.map[y][x];
          const i = y * this.cols + x;
          const right: Dir = cfg.transpose ? 2 : 1;
          const left: Dir = cfg.transpose ? 0 : 3;
          switch (ch) {
            case '#':
              this.cells[i] = CELL_ROCK;
              break;
            case 'L':
              this.cells[i] = CELL_LOCK;
              break;
            case 'S':
              this.startCells.push({ pos: { x, y }, dir: right, kind: 'player' });
              break;
            case 'X':
              this.startCells.push({ pos: { x, y }, dir: left, kind: 'rival' });
              break;
            case 'K':
              this.addItem('key', x, y, 'key', 0);
              break;
            case 'G':
              this.addItem('coin', x, y, 'coin', 5);
              break;
            default:
              if (/[ABC]/i.test(ch)) {
                const key = ch.toUpperCase();
                pairs[key] ??= {};
                if (ch === key) pairs[key].a = { x, y };
                else pairs[key].b = { x, y };
              }
          }
        }
      }
      Object.keys(pairs)
        .sort()
        .forEach((k, idx) => {
          const p = pairs[k];
          if (p.a && p.b) this.portals.push({ a: p.a, b: p.b, color: PORTAL_COLORS[idx % PORTAL_COLORS.length] });
        });
    }
  }

  private placeRandomPortal(idx: number) {
    const a = this.randomFreeCell(2, true);
    const b = this.randomFreeCell(2, true, a ? [a] : []);
    if (a && b) this.portals.push({ a, b, color: PORTAL_COLORS[idx % PORTAL_COLORS.length] });
  }

  private spawnSnakes() {
    const { cfg } = this;
    const mid = (n: number) => Math.floor(n / 2);
    const t = cfg.transpose;
    const R: Dir = t ? 2 : 1;
    const L: Dir = t ? 0 : 3;
    const pos = (x: number, y: number): Vec => (t ? { x: y, y: x } : { x, y });
    const W = t ? this.rows : this.cols;
    const H = t ? this.cols : this.rows;

    if (cfg.level) {
      const start = this.startCells.find((s) => s.kind === 'player')!;
      this.snakes.push(this.makeSnake('p1', 'Ты', start.pos, start.dir, 3, cfg.skin, cfg.hat));
      const rival = this.startCells.find((s) => s.kind === 'rival');
      if (rival && cfg.level.rival) {
        const s = this.makeSnake('bot', 'Соперник', rival.pos, rival.dir, 3, 'sunset', 'tophat');
        s.botLevel = cfg.level.rival;
        s.stepMs = cfg.level.stepMs * this.rivalSlowdown();
        this.rivalId = s.id;
        this.snakes.push(s);
      }
    } else if (cfg.mode === 'duel') {
      this.snakes.push(this.makeSnake('p1', 'Игрок 1', pos(3, mid(H) - 2), R, 4, cfg.skin, cfg.hat));
      this.snakes.push(this.makeSnake('p2', 'Игрок 2', pos(W - 4, mid(H) + 2), L, 4, cfg.p2Skin ?? 'sunset', 'none'));
    } else {
      if (cfg.mode !== 'demo') {
        this.snakes.push(
          this.makeSnake('p1', 'Ты', pos(Math.max(3, Math.floor(W / 4)), mid(H)), R, cfg.mode === 'arena' ? 5 : 3, cfg.skin, cfg.hat),
        );
      }
      const bots = cfg.bots?.count ?? 0;
      const botSkins = this.rng.shuffle(SKINS.filter((s) => s.id !== cfg.skin).map((s) => s.id));
      const botHats = this.rng.shuffle(HATS.map((h) => h.id));
      const names = this.rng.shuffle([...BOT_NAMES]);
      for (let b = 0; b < bots; b++) {
        const spot = this.botSpawnSpot(b);
        const s = this.makeSnake(
          'bot',
          names[b % names.length],
          spot.pos,
          spot.dir,
          5,
          botSkins[b % botSkins.length],
          botHats[b % botHats.length],
        );
        s.botLevel = cfg.bots!.level;
        this.snakes.push(s);
      }
    }
    for (const s of this.snakes) s.prevBody = s.body.slice();
  }

  private rivalSlowdown() {
    return (this.cfg.level?.rival ?? 1) <= 1 ? 1.14 : 1.06;
  }

  private botSpawnSpot(index: number): { pos: Vec; dir: Dir } {
    const spots: { x: number; y: number; dir: Dir }[] = [
      { x: this.cols - 7, y: 2, dir: 3 },
      { x: 6, y: this.rows - 3, dir: 1 },
      { x: this.cols - 7, y: this.rows - 3, dir: 3 },
      { x: 6, y: 2, dir: 1 },
      { x: Math.floor(this.cols / 2) + 2, y: 5, dir: 3 },
      { x: Math.floor(this.cols / 2) - 2, y: this.rows - 6, dir: 1 },
    ];
    const s = spots[index % spots.length];
    return { pos: { x: s.x, y: s.y }, dir: s.dir };
  }

  private makeSnake(controller: Controller, name: string, head: Vec, dir: Dir, len: number, skin: string, hat: string): Snake {
    const body: Vec[] = [];
    for (let i = 0; i < len; i++) {
      body.push({
        x: (head.x - DX[dir] * i + this.cols) % this.cols,
        y: (head.y - DY[dir] * i + this.rows) % this.rows,
      });
    }
    return {
      id: this.snakes.length,
      name,
      controller,
      body,
      prevBody: body.slice(),
      dir,
      queue: [],
      alive: true,
      skin,
      hat,
      stepDebt: 0,
      nextDebt: 0,
      earlyTurned: false,
      grow: 0,
      score: 0,
      fruits: 0,
      kills: 0,
      effects: {},
      shield: false,
      reversed: 0,
      moveAcc: 0,
      stepMs: this.cfg.level?.stepMs ?? this.cfg.stepMs,
      boosting: false,
      boostSteps: 0,
      gulps: [],
      combo: 0,
      comboTimer: 0,
      maxCombo: 0,
      deadTime: 0,
      respawnIn: 0,
      invuln: 0,
      botLevel: 1,
      teleported: false,
      wrapped: false,
    };
  }

  private resetTimers() {
    this.goldenTimer = this.rng.range(12000, 20000);
    this.powerTimer = this.rng.range(6000, 10000);
    this.coinTimer = this.rng.range(14000, 22000);
    this.clockTimer = 5000;
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  get player(): Snake | undefined {
    return this.snakes.find((s) => s.controller === 'p1');
  }

  /** Queues a turn. Returns whether it was accepted, so callers can be honest
   *  about haptics and turn sounds instead of buzzing on rejected reversals. */
  input(controller: Controller, dir: Dir): boolean {
    if (this.phase !== 'playing' && this.phase !== 'countdown') return false;
    const s = this.snakes.find((sn) => sn.controller === controller);
    if (!s || !s.alive) return false;
    if (s.reversed > 0) dir = opposite(dir);
    const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
    if (dir === last || dir === opposite(last)) return false;
    if (s.queue.length >= 3) return false;
    s.queue.push(dir);
    return true;
  }

  /** Turn relative to where the snake is already heading: -1 left, +1 right. */
  inputRelative(controller: Controller, delta: -1 | 1): boolean {
    const s = this.snakes.find((sn) => sn.controller === controller);
    if (!s) return false;
    const from = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
    // `input` re-applies the reversed-controls flip, so undo it here to keep
    // "left" meaning the player's left in both cases.
    const turned = (((from + delta) % 4) + 4) % 4;
    const dir = (s.reversed > 0 ? opposite(turned as Dir) : turned) as Dir;
    return this.input(controller, dir);
  }

  /**
   * Commits a queued turn straight away when the snake has only just entered
   * its cell, and books the borrowed time as debt against the next step. The
   * turn lands on the next frame instead of up to a full step later, while
   * average speed is unchanged — the following step waits exactly as long as
   * this one was cut short, so the snake never ends up more than one partial
   * cell ahead of where it would otherwise be.
   */
  private tryEarlyTurn(s: Snake) {
    if (this.cfg.earlyTurn === false || s.controller === 'bot') return;
    // Only when nothing is owed. Borrowing again before the previous debt is
    // repaid would let a zig-zag compound into free speed.
    if (s.stepDebt > 0 || s.earlyTurned || !s.queue.length) return;
    const d = s.queue[0];
    if (d === s.dir || d === opposite(s.dir)) return;
    const step = this.effectiveStep(s);
    if (s.moveAcc >= step * EARLY_TURN_FRAC) return;
    s.nextDebt = step - s.moveAcc;
    s.moveAcc = step;
    s.earlyTurned = true;
  }

  setBoost(controller: Controller, on: boolean) {
    const s = this.snakes.find((sn) => sn.controller === controller);
    if (s) s.boosting = on;
  }

  pause() {
    if (this.phase === 'playing' || this.phase === 'countdown') this.phase = 'paused';
  }

  resume() {
    if (this.phase === 'paused') {
      this.phase = 'countdown';
      this.countdownMs = 1500;
    }
  }

  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  idx(x: number, y: number) {
    return y * this.cols + x;
  }

  portalAt(x: number, y: number): { exit: Vec; portal: Portal } | null {
    for (const p of this.portals) {
      if (p.a.x === x && p.a.y === y) return { exit: p.b, portal: p };
      if (p.b.x === x && p.b.y === y) return { exit: p.a, portal: p };
    }
    return null;
  }

  /** Next cell when moving from (x,y) in `dir`, following wrap and portals. Null = off the board. */
  nextCell(x: number, y: number, dir: Dir, canWrap = this.wrap): { x: number; y: number; teleported: boolean; wrapped: boolean } | null {
    let nx = x + DX[dir];
    let ny = y + DY[dir];
    let wrapped = false;
    if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) {
      if (!canWrap) return null;
      nx = (nx + this.cols) % this.cols;
      ny = (ny + this.rows) % this.rows;
      wrapped = true;
    }
    const portal = this.portalAt(nx, ny);
    if (portal) return { x: portal.exit.x, y: portal.exit.y, teleported: true, wrapped };
    return { x: nx, y: ny, teleported: false, wrapped };
  }

  effectiveStep(s: Snake): number {
    let ms = s.stepMs;
    if (s.effects.turbo) ms *= 0.66;
    if (s.boosting) ms *= 0.6;
    if (s.effects.freeze) ms *= 1.45;
    if (this.snakes.some((o) => o !== s && o.alive && o.effects.freeze)) ms *= 1.6;
    // The debt is part of the step, so the renderer's moveAcc/step interpolation
    // stretches with it instead of racing ahead and then stalling.
    return ms + s.stepDebt;
  }

  // ─── Update ─────────────────────────────────────────────────────────────

  update(dtRaw: number) {
    const dt = Math.min(dtRaw, 50);
    switch (this.phase) {
      case 'countdown':
        this.countdownMs -= dt;
        if (this.countdownMs <= 0) this.phase = 'playing';
        return;
      case 'paused':
      case 'over':
        return;
      case 'dying':
        this.dyingTimer -= dt;
        this.advanceGulps(dt);
        if (this.dyingTimer <= 0) this.finish(this.pendingWin, this.pendingReason);
        return;
      case 'roundOver':
        this.roundTimer -= dt;
        if (this.roundTimer <= 0) this.nextRound();
        return;
    }

    this.time += dt;

    if (this.cfg.timeLimitMs) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.events.push({ type: 'timeUp' });
        this.onTimeUp();
        return;
      }
    }

    this.updateItems(dt);

    for (const s of this.snakes) {
      if (!s.alive) {
        if (s.respawnIn > 0) {
          s.respawnIn -= dt;
          if (s.respawnIn <= 0) this.respawn(s);
        }
        continue;
      }
      for (const key of Object.keys(s.effects) as PowerId[]) {
        s.effects[key]! -= dt;
        if (s.effects[key]! <= 0) {
          delete s.effects[key];
          this.events.push({ type: 'powerEnd', snake: s.id, power: key });
        }
      }
      if (s.reversed > 0) s.reversed = Math.max(0, s.reversed - dt);
      if (s.invuln > 0) s.invuln = Math.max(0, s.invuln - dt);
      if (s.comboTimer > 0) {
        s.comboTimer -= dt;
        if (s.comboTimer <= 0) s.combo = 0;
      }
    }

    // Step snakes. Order is fixed so simultaneous steps are deterministic.
    for (const s of this.snakes) {
      if (!s.alive) continue;
      s.moveAcc += dt;
      this.tryEarlyTurn(s);
      let guard = 0;
      while (s.alive && guard++ < 3) {
        const step = this.effectiveStep(s);
        if (s.moveAcc < step) break;
        s.moveAcc -= step;
        this.stepSnake(s);
        s.stepDebt = s.nextDebt;
        s.nextDebt = 0;
        s.earlyTurned = false;
        if (this.phase !== 'playing') break;
      }
      if (this.phase !== 'playing') break;
    }

    this.advanceGulps(dt);

    if (this.phase === 'playing' && this.cfg.mode === 'duel') {
      const alive = this.snakes.filter((s) => s.alive);
      if (alive.length <= 1) this.endRound(alive[0]?.id ?? null);
    }
  }

  private advanceGulps(dt: number) {
    for (const s of this.snakes) {
      if (!s.gulps.length) continue;
      const speed = dt / this.effectiveStep(s);
      s.gulps = s.gulps.map((g) => g + speed * 1.1).filter((g) => g < s.body.length + 1);
    }
  }

  private updateItems(dt: number) {
    const frozen = this.snakes.some((s) => s.alive && s.effects.freeze);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it.ttl !== undefined && !frozen) {
        it.ttl -= dt;
        if (it.ttl <= 0) this.items.splice(i, 1);
      }
    }

    const mode = this.cfg.mode;
    const extras = mode !== 'duel' && !this.cfg.level;

    if (extras) {
      this.goldenTimer -= dt;
      if (this.goldenTimer <= 0) {
        this.goldenTimer = this.rng.range(15000, 25000);
        this.spawnItem('golden', 'apple', 50, 6500);
      }
      if (mode !== 'demo') {
        this.coinTimer -= dt;
        if (this.coinTimer <= 0) {
          this.coinTimer = this.rng.range(12000, 20000);
          this.spawnItem('coin', 'coin', 5, 8000);
        }
      }
    }

    if (this.cfg.powerups || this.cfg.level?.powerups) {
      this.powerTimer -= dt;
      if (this.powerTimer <= 0) {
        this.powerTimer = this.rng.range(8000, 13000);
        if (this.items.filter((i) => i.kind === 'power').length < 2) {
          const pool = POWER_LIST.filter((p) => mode !== 'duel' || p.id !== 'scissors');
          const p = this.rng.pick(pool);
          this.spawnItem('power', p.sprite, 0, 10000, p.id);
        }
      }
    }

    if (mode === 'blitz') {
      this.clockTimer -= dt;
      if (this.clockTimer <= 0) {
        this.clockTimer = this.rng.range(6000, 9000);
        if (!this.items.some((i) => i.kind === 'clock')) this.spawnItem('clock', 'stopwatch', 0, 7000);
      }
    }

    // Magnet: pull nearby food toward the head.
    for (const s of this.snakes) {
      if (!s.alive || !s.effects.magnet) continue;
      const head = s.body[0];
      for (const it of this.items) {
        if (it.kind === 'poison' || it.kind === 'key' || it.kind === 'power') continue;
        const dx = head.x - it.x;
        const dy = head.y - it.y;
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist === 0 || dist > 7) continue;
        it.pull = (it.pull ?? 0) + dt;
        if (it.pull < 110) continue;
        it.pull = 0;
        const nx = it.x + (Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0);
        const ny = it.y + (Math.abs(dx) >= Math.abs(dy) ? 0 : Math.sign(dy));
        if (this.cells[this.idx(nx, ny)] === CELL_EMPTY && !this.itemAt(nx, ny) && !this.portalAt(nx, ny)) {
          if (!this.snakes.some((o) => o !== s && o.alive && o.body.some((b) => b.x === nx && b.y === ny))) {
            it.x = nx;
            it.y = ny;
          }
        }
      }
    }

    this.fillItems();
  }

  private fillItems() {
    const want = this.mutators.has('feast') ? 5 : this.cfg.fruitCount;
    let fruits = this.items.filter((i) => i.kind === 'fruit').length;
    let guard = 0;
    while (fruits < want && guard++ < 10) {
      if (!this.spawnItem('fruit', this.rng.pick(FRUITS), 10)) break;
      fruits++;
    }
    if (this.mutators.has('poison')) {
      const poison = this.items.filter((i) => i.kind === 'poison').length;
      if (poison < 2 && this.rng.chance(0.02)) this.spawnItem('poison', 'mushroom', 0, 14000);
    }
  }

  itemAt(x: number, y: number): Item | undefined {
    return this.items.find((i) => i.x === x && i.y === y);
  }

  private addItem(kind: ItemKind, x: number, y: number, sprite: string, value: number, ttl?: number, power?: PowerId, color?: string) {
    const it: Item = { id: this.nextId++, kind, x, y, sprite, value, ttl, maxTtl: ttl, power, born: this.time, color };
    this.items.push(it);
    return it;
  }

  private spawnItem(kind: ItemKind, sprite: string, value: number, ttl?: number, power?: PowerId) {
    const cell = this.randomFreeCell(kind === 'fruit' ? 2 : 3);
    if (!cell) return null;
    return this.addItem(kind, cell.x, cell.y, sprite, value, ttl, power);
  }

  private computeReachable(): number {
    let count = 1;
    this.reachable = new Uint8Array(this.cols * this.rows);
    const start = this.player?.body[0] ?? this.snakes[0]?.body[0] ?? { x: 0, y: 0 };
    const stack = [start];
    this.reachable[this.idx(start.x, start.y)] = 1;
    while (stack.length) {
      const c = stack.pop()!;
      for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
        const n = this.nextCell(c.x, c.y, d);
        if (!n) continue;
        const i = this.idx(n.x, n.y);
        if (this.reachable[i] || this.cells[i] === CELL_ROCK) continue;
        this.reachable[i] = 1;
        count++;
        stack.push({ x: n.x, y: n.y });
      }
    }
    return count;
  }

  randomFreeCell(minHeadDist = 2, awayFromEdges = false, avoid: Vec[] = []): Vec | null {
    if (!this.reachable) this.computeReachable();
    const ok = (x: number, y: number) => {
      const i = this.idx(x, y);
      if (this.cells[i] !== CELL_EMPTY || !this.reachable[i]) return false;
      if (awayFromEdges && (x < 1 || y < 1 || x >= this.cols - 1 || y >= this.rows - 1)) return false;
      if (this.itemAt(x, y) || this.portalAt(x, y)) return false;
      // Skip dead-end pockets: a long snake could never get back out.
      let open = 0;
      for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
        const n = this.nextCell(x, y, d);
        if (n && this.cells[this.idx(n.x, n.y)] !== CELL_ROCK) open++;
      }
      if (open < 2) return false;
      if (avoid.some((a) => Math.abs(a.x - x) + Math.abs(a.y - y) < 4)) return false;
      for (const s of this.snakes) {
        if (!s.alive) continue;
        const h = s.body[0];
        if (s.controller !== 'bot' && Math.abs(h.x - x) + Math.abs(h.y - y) < minHeadDist) return false;
        if (s.body.some((b) => b.x === x && b.y === y)) return false;
      }
      return true;
    };
    for (let t = 0; t < 80; t++) {
      const x = this.rng.int(this.cols);
      const y = this.rng.int(this.rows);
      if (ok(x, y)) return { x, y };
    }
    const all: Vec[] = [];
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) if (ok(x, y)) all.push({ x, y });
    return all.length ? this.rng.pick(all) : null;
  }

  // ─── Movement ───────────────────────────────────────────────────────────

  private stepSnake(s: Snake) {
    s.prevBody = s.body.slice();
    s.teleported = false;
    s.wrapped = false;

    if (s.controller === 'bot') {
      s.dir = decideBotMove(this, s);
      s.queue.length = 0;
    } else {
      while (s.queue.length) {
        const d = s.queue.shift()!;
        if (d !== s.dir && d !== opposite(s.dir)) {
          s.dir = d;
          break;
        }
      }
    }

    const head = s.body[0];
    const ghost = !!s.effects.ghost || s.invuln > 0;
    const next = this.nextCell(head.x, head.y, s.dir, this.wrap || ghost);
    if (!next) {
      this.collide(s, 'wall');
      return;
    }
    s.teleported = next.teleported;
    s.wrapped = next.wrapped;

    const cell = this.cells[this.idx(next.x, next.y)];
    let hit: { reason: string; by?: number } | null = null;
    if (cell !== CELL_EMPTY) hit = { reason: cell === CELL_LOCK ? 'lock' : 'rock' };

    if (!hit) {
      for (const o of this.snakes) {
        if (!o.alive) continue;
        const own = o === s;
        if (own && this.mutators.has('cheese')) continue;
        const tailMoves = own && s.grow === 0;
        const len = tailMoves ? o.body.length - 1 : o.body.length;
        for (let j = own ? 1 : 0; j < len; j++) {
          const b = o.body[j];
          if (b.x === next.x && b.y === next.y) {
            if (!own && j === 0) {
              hit = { reason: 'headon', by: o.id };
            } else {
              hit = { reason: own ? 'self' : 'snake', by: own ? undefined : o.id };
            }
            break;
          }
        }
        if (hit) break;
      }
    }

    if (hit && !ghost) {
      if (s.shield) {
        s.shield = false;
        s.invuln = 1400;
        this.stats.shieldsSaved += s.controller === 'p1' ? 1 : 0;
        this.events.push({ type: 'shield', snake: s.id, x: next.x, y: next.y });
      } else {
        if (hit.reason === 'headon' && hit.by !== undefined) {
          const other = this.snakes[hit.by];
          // The longer snake survives a head-on crash; equal lengths — both die.
          if (other.body.length > s.body.length) {
            this.collide(s, 'headon', other.id);
          } else if (other.body.length < s.body.length) {
            this.collide(other, 'headon', s.id);
            if (this.phase !== 'playing') return;
          } else {
            this.collide(other, 'headon');
            this.collide(s, 'headon');
          }
          if (!s.alive || this.phase !== 'playing') return;
        } else {
          this.collide(s, hit.reason, hit.by);
          return;
        }
      }
    }

    if (next.teleported) {
      if (s.controller === 'p1') this.stats.portals++;
      this.events.push({ type: 'portal', snake: s.id, x: head.x + DX[s.dir], y: head.y + DY[s.dir], x2: next.x, y2: next.y });
    }

    s.body.unshift({ x: next.x, y: next.y });
    if (s.grow > 0) s.grow--;
    else s.body.pop();

    // Arena boost burns length.
    if (s.boosting && this.cfg.mode === 'arena') {
      s.boostSteps++;
      if (s.boostSteps % 5 === 0 && s.body.length > 5) {
        const tail = s.body.pop()!;
        s.prevBody.pop();
        if (!this.itemAt(tail.x, tail.y) && this.rng.chance(0.7))
          this.addItem('orb', tail.x, tail.y, '', 5, 14000, undefined, this.snakeColor(s));
        this.events.push({ type: 'boostDrop', snake: s.id });
      }
    }

    const item = this.itemAt(next.x, next.y);
    if (item) this.consume(s, item);
  }

  private snakeColor(s: Snake) {
    const skin = SKINS.find((k) => k.id === s.skin) ?? SKINS[0];
    return skin.preview[0];
  }

  private consume(s: Snake, item: Item) {
    const idx = this.items.indexOf(item);
    if (idx >= 0) this.items.splice(idx, 1);
    const head = s.body[0];
    let points = 0;

    const bumpCombo = () => {
      s.combo = s.comboTimer > 0 ? s.combo + 1 : 1;
      s.comboTimer = Math.max(2200, s.stepMs * 24);
      s.maxCombo = Math.max(s.maxCombo, s.combo);
    };
    const mult = () => {
      let m = 1 + Math.floor((s.combo - 1) / 3);
      m = Math.min(m, 6);
      if (s.effects.turbo) m *= 2;
      if (s.boosting && this.cfg.mode !== 'arena') m *= 1.5;
      return m * this.cfg.scoreMult;
    };

    switch (item.kind) {
      case 'fruit':
      case 'orb':
      case 'golden': {
        bumpCombo();
        const base = item.kind === 'golden' ? 50 : item.kind === 'orb' ? 5 : 10;
        points = Math.round(base * mult());
        s.grow += item.kind === 'golden' ? 2 : 1;
        s.fruits += item.kind === 'orb' ? 0 : 1;
        s.gulps.push(0);
        if (item.kind === 'golden' && s.controller === 'p1') this.stats.goldens++;
        if (item.kind !== 'orb') {
          if (this.mutators.has('walls')) this.dropRock(s);
          if (this.mutators.has('turbo')) s.stepMs = Math.max(62, s.stepMs * 0.955);
          if (this.mutators.has('portals') && this.rng.chance(0.25) && this.portals.length) this.shufflePortal();
        }
        break;
      }
      case 'poison':
        s.reversed = 4500;
        s.combo = 0;
        s.comboTimer = 0;
        points = -Math.min(s.score, 20);
        if (s.body.length > 4) {
          s.body.splice(-2);
          s.prevBody.splice(-2);
        }
        break;
      case 'clock':
        this.timeLeft += 5000;
        break;
      case 'coin':
        points = Math.round(5 * this.cfg.scoreMult);
        if (s.controller === 'p1') this.stats.coins++;
        break;
      case 'key':
        for (let i = 0; i < this.cells.length; i++) {
          if (this.cells[i] === CELL_LOCK) {
            this.cells[i] = CELL_EMPTY;
            this.events.push({ type: 'unlock', x: i % this.cols, y: Math.floor(i / this.cols) });
          }
        }
        points = 25;
        break;
      case 'power': {
        const p = item.power!;
        if (s.controller === 'p1') this.stats.powers[p] = (this.stats.powers[p] ?? 0) + 1;
        if (p === 'shield') s.shield = true;
        else if (p === 'scissors') {
          const cut = Math.floor((s.body.length - 3) / 2);
          if (cut > 0) {
            s.body.splice(-cut);
            s.prevBody.splice(-cut);
            s.grow = 0;
            points = cut * 8;
          }
        } else {
          s.effects[p] = POWERS[p].durationMs;
        }
        break;
      }
    }

    s.score = Math.max(0, s.score + points);
    this.events.push({
      type: 'eat',
      snake: s.id,
      x: head.x,
      y: head.y,
      points,
      combo: s.combo,
      kind: item.kind,
      sprite: item.sprite,
      power: item.power,
    });

    if (this.cfg.level && item.kind === 'fruit') {
      if (s.id === this.rivalId && s.fruits >= this.goal) {
        this.endWithDeath(false, 'rival');
      } else if (s.controller === 'p1' && s.fruits >= this.goal) {
        this.finish(true, 'goal');
      }
    }
    this.fillItems();
  }

  private dropRock(s: Snake) {
    const head = s.body[0];
    for (let t = 0; t < 30; t++) {
      const c = this.randomFreeCell(4);
      if (!c) return;
      // Keep the cell right in front of every head free.
      const ahead = this.snakes.some(
        (o) => o.alive && Math.abs(o.body[0].x + DX[o.dir] * 2 - c.x) + Math.abs(o.body[0].y + DY[o.dir] * 2 - c.y) < 3,
      );
      if (ahead) continue;
      const before = this.computeReachable();
      this.cells[this.idx(c.x, c.y)] = CELL_ROCK;
      const after = this.computeReachable();
      // Never split the board: every open cell must stay reachable.
      if (after < before - 1 || !this.reachable[this.idx(head.x, head.y)]) {
        this.cells[this.idx(c.x, c.y)] = CELL_EMPTY;
        this.computeReachable();
        continue;
      }
      this.events.push({ type: 'rock', x: c.x, y: c.y });
      return;
    }
  }

  private shufflePortal() {
    const i = this.rng.int(this.portals.length);
    const p = this.portals[i];
    const busy = (v: Vec) => this.snakes.some((s) => s.body.some((b) => Math.abs(b.x - v.x) + Math.abs(b.y - v.y) < 2));
    if (busy(p.a) || busy(p.b)) return;
    this.portals.splice(i, 1);
    const a = this.randomFreeCell(3, true);
    const b = this.randomFreeCell(3, true, a ? [a] : []);
    this.portals.push(a && b ? { a, b, color: p.color } : p);
  }

  // ─── Death / rounds / results ───────────────────────────────────────────

  private collide(s: Snake, reason: string, by?: number) {
    if (!s.alive) return;
    s.alive = false;
    s.deadTime = this.time;
    s.queue.length = 0;
    s.stepDebt = 0;
    s.nextDebt = 0;
    s.earlyTurned = false;
    const head = s.body[0];
    this.events.push({ type: 'die', snake: s.id, x: head.x, y: head.y, by, reason });
    if (by !== undefined && by !== s.id && this.snakes[by]) {
      this.snakes[by].kills++;
      this.snakes[by].score += this.cfg.mode === 'arena' ? 100 : 0;
      this.events.push({ type: 'kill', snake: by, victim: s.id });
    }

    const mode = this.cfg.mode;
    if (mode === 'arena' || mode === 'demo') {
      for (let i = 0; i < s.body.length; i++) {
        const b = s.body[i];
        if (i % 2 === 0 && !this.itemAt(b.x, b.y) && this.cells[this.idx(b.x, b.y)] === CELL_EMPTY) {
          this.addItem('orb', b.x, b.y, '', 5, 16000, undefined, this.snakeColor(s));
        }
      }
    }

    if (s.controller === 'bot') {
      if (mode === 'arena' || mode === 'demo') s.respawnIn = 3000;
      else if (s.id === this.rivalId) s.respawnIn = 2000;
      return;
    }

    if (mode === 'blitz') {
      this.timeLeft = Math.max(0, this.timeLeft - 10000);
      s.respawnIn = 700;
      s.combo = 0;
      if (this.timeLeft <= 0) this.endWithDeath(true, 'time');
      return;
    }
    if (mode === 'duel') return;

    this.endWithDeath(mode !== 'campaign', reason);
  }

  private endWithDeath(win: boolean, reason: string) {
    this.phase = 'dying';
    this.dyingTimer = 1300;
    this.pendingWin = win;
    this.pendingReason = reason;
  }

  private respawn(s: Snake) {
    const len = s.controller === 'bot' ? 5 : 4;
    for (let t = 0; t < 40; t++) {
      const c = this.randomFreeCell(6, true);
      if (!c) return;
      const dir = this.rng.int(4) as Dir;
      const cells: Vec[] = [];
      let ok = true;
      for (let i = 0; i < len + 3; i++) {
        const x = c.x - DX[dir] * (i - 3);
        const y = c.y - DY[dir] * (i - 3);
        if (x < 0 || y < 0 || x >= this.cols || y >= this.rows || this.cells[this.idx(x, y)] !== CELL_EMPTY || this.portalAt(x, y)) {
          ok = false;
          break;
        }
        if (this.snakes.some((o) => o.alive && o.body.some((b) => b.x === x && b.y === y))) {
          ok = false;
          break;
        }
        if (i >= 3) cells.push({ x, y });
      }
      if (!ok) continue;
      s.body = cells;
      s.prevBody = cells.slice();
      s.dir = dir;
      s.alive = true;
      s.grow = 0;
      s.effects = {};
      s.gulps = [];
      s.invuln = s.controller === 'bot' ? 1200 : 2200;
      s.moveAcc = 0;
      s.stepMs = (this.cfg.level?.stepMs ?? this.cfg.stepMs) * (s.id === this.rivalId ? this.rivalSlowdown() : 1);
      this.events.push({ type: 'respawn', snake: s.id });
      return;
    }
    s.respawnIn = 500;
  }

  private onTimeUp() {
    this.finish(this.cfg.mode === 'arena' ? this.arenaRank() === 1 : true, 'time');
  }

  arenaRank(): number {
    const p = this.player;
    if (!p) return 0;
    return 1 + this.snakes.filter((s) => s !== p && s.score > p.score).length;
  }

  private endRound(winner: number | null) {
    if (winner !== null) this.duelWins[winner]++;
    this.lastRoundWinner = winner;
    this.events.push({ type: 'round', winner });
    const target = this.cfg.duelRounds ?? 3;
    if (this.duelWins[0] >= target || this.duelWins[1] >= target) {
      this.phase = 'dying';
      this.dyingTimer = 1500;
      this.pendingWin = true;
      this.pendingReason = 'duel';
      return;
    }
    this.phase = 'roundOver';
    this.roundTimer = 2200;
  }

  private nextRound() {
    this.round++;
    const skins = this.snakes.map((s) => ({ skin: s.skin, hat: s.hat, name: s.name, controller: s.controller }));
    const keepScore = this.snakes.map((s) => s.score);
    this.snakes = [];
    this.items = [];
    this.cells.fill(CELL_EMPTY);
    this.spawnSnakes();
    this.snakes.forEach((s, i) => {
      s.skin = skins[i].skin;
      s.hat = skins[i].hat;
      s.score = keepScore[i];
    });
    this.resetTimers();
    this.fillItems();
    this.phase = 'countdown';
    this.countdownMs = 2000;
  }

  private finish(win: boolean, reason: string) {
    if (this.phase === 'over') return;
    this.phase = 'over';
    const p = this.player ?? this.snakes[0];
    const level = this.cfg.level;
    const seconds = this.time / 1000;
    let finalWin = win;
    if (this.cfg.mode === 'daily' && this.cfg.goalScore) finalWin = p.score >= this.cfg.goalScore;
    if (this.cfg.mode === 'arena') finalWin = reason === 'time' && this.arenaRank() === 1;

    const duelWinner =
      this.cfg.mode === 'duel' ? (this.duelWins[0] === this.duelWins[1] ? null : this.duelWins[0] > this.duelWins[1] ? 0 : 1) : undefined;

    this.result = {
      mode: this.cfg.mode,
      win: finalWin,
      score: p.score,
      length: p.body.length,
      fruits: p.fruits,
      timeMs: this.time,
      maxCombo: p.maxCombo,
      kills: p.kills,
      coinsPicked: this.stats.coins,
      goldens: this.stats.goldens,
      powers: this.stats.powers,
      portals: this.stats.portals,
      shieldsSaved: this.stats.shieldsSaved,
      stars: level && win ? starsFor(level, seconds) : 0,
      rank: this.cfg.mode === 'arena' ? this.arenaRank() : 0,
      levelId: level?.id,
      mutators: [...this.mutators],
      duelWinner,
      duelScore: this.cfg.mode === 'duel' ? ([...this.duelWins] as [number, number]) : undefined,
      reason,
    };
    if (win) this.events.push({ type: 'win' });
  }
}
