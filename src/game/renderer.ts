import { sprite } from './assets';
import { hatById, POWERS, skinById, themeById, type SkinDef, type ThemeDef } from './content';
import { CELL_LOCK, CELL_ROCK, type Engine } from './engine';
import { DX, DY, type GameEvent, type Item, type Snake } from './types';

// ─── Particles & floating text ──────────────────────────────────────────────

type Shape = 'circle' | 'star' | 'spark' | 'ring' | 'square';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  shape: Shape;
  gravity: number;
  spin: number;
}

interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  max: number;
  size: number;
}

export const FRUIT_COLORS: Record<string, string> = {
  apple: '#ef4444', tangerine: '#fb923c', grapes: '#a855f7', strawberry: '#f43f5e', banana: '#facc15',
  cherries: '#dc2626', watermelon: '#22c55e', peach: '#fdba74', pineapple: '#eab308', kiwi: '#84cc16',
  lemon: '#fde047', blueberries: '#6366f1', coin: '#fbbf24', key: '#f59e0b', stopwatch: '#f87171', mushroom: '#dc2626',
};

const TAU = Math.PI * 2;
const FRAME = 0.42; // board frame thickness, in cells

export interface Pt {
  x: number;
  y: number;
  seg: number;
}

// ─── Snake drawing (shared by the game and the shop preview) ────────────────

export interface SnakeLook {
  skin: SkinDef;
  hat: string;
  time: number;
  alpha: number;
  alive: boolean;
  gulps: number[];
  lookAt?: { x: number; y: number };
  dizzy?: boolean;
  shield?: boolean;
  ghost?: boolean;
  turbo?: boolean;
  magnet?: boolean;
  freeze?: boolean;
  blinkSeed: number;
  name?: string;
  leader?: boolean;
}

function resample(chunk: Pt[], spacing: number): Pt[] {
  if (chunk.length === 1) return chunk.slice();
  const out: Pt[] = [chunk[0]];
  for (let i = 1; i < chunk.length; i++) {
    const a = chunk[i - 1];
    const b = chunk[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(d / spacing));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, seg: a.seg + (b.seg - a.seg) * t });
    }
  }
  return out;
}

export function drawSnakeShape(
  ctx: CanvasRenderingContext2D,
  chunks: Pt[][],
  len: number,
  cs: number,
  ox: number,
  oy: number,
  look: SnakeLook,
) {
  if (!chunks.length || !chunks[0].length) return;
  const { skin, time } = look;
  const samples: Pt[] = [];
  for (const c of chunks) samples.push(...resample(c, 0.2));
  // Tail first so the head lands on top.
  samples.sort((a, b) => b.seg - a.seg);

  const baseR = 0.39 * cs;
  const radius = (seg: number) => {
    const f = len <= 1 ? 1 : seg / Math.max(len - 1, 1);
    let r = baseR * (f < 0.55 ? 1 : 1 - (f - 0.55) * 0.9);
    for (const g of look.gulps) {
      const d = seg - g;
      r += baseR * 0.32 * Math.exp(-d * d * 1.6);
    }
    return Math.max(r, baseR * 0.45);
  };
  const px = (p: Pt) => ox + p.x * cs;
  const py = (p: Pt) => oy + p.y * cs;

  ctx.save();
  ctx.globalAlpha = look.alpha * (look.ghost ? 0.55 : 1);

  // Soft drop shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath();
  for (const p of samples) {
    const r = radius(p.seg);
    ctx.moveTo(px(p) + cs * 0.07 + r, py(p) + cs * 0.13);
    ctx.arc(px(p) + cs * 0.07, py(p) + cs * 0.13, r, 0, TAU);
  }
  ctx.fill();

  // Outline.
  if (skin.glow || look.turbo) {
    ctx.shadowColor = look.turbo ? '#facc15' : skin.glow!;
    ctx.shadowBlur = cs * (look.turbo ? 0.9 : 0.6);
  }
  ctx.fillStyle = look.freeze ? '#38bdf8' : skin.outline;
  ctx.beginPath();
  const ow = Math.max(1.5, cs * 0.06);
  for (const p of samples) {
    const r = radius(p.seg) + ow;
    ctx.moveTo(px(p) + r, py(p));
    ctx.arc(px(p), py(p), r, 0, TAU);
  }
  ctx.fill();
  ctx.shadowBlur = 0;

  // Colour, batched by consecutive identical colours.
  let current = '';
  ctx.beginPath();
  for (const p of samples) {
    const col = skin.color(Math.round(p.seg * 2) / 2 | 0, len, time);
    if (col !== current) {
      if (current) ctx.fill();
      ctx.fillStyle = col;
      current = col;
      ctx.beginPath();
    }
    const r = radius(p.seg);
    ctx.moveTo(px(p) + r, py(p));
    ctx.arc(px(p), py(p), r, 0, TAU);
  }
  ctx.fill();

  // Glossy highlight.
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  for (let i = 0; i < samples.length; i += 2) {
    const p = samples[i];
    const r = radius(p.seg) * 0.42;
    ctx.moveTo(px(p) - r * 0.35 + r, py(p) - r * 0.6);
    ctx.arc(px(p) - r * 0.35, py(p) - r * 0.6, r, 0, TAU);
  }
  ctx.fill();

  // ── Head ──
  const headChunk = chunks[0];
  const h = headChunk[0];
  const neck = headChunk[1] ?? { x: h.x - 1, y: h.y, seg: 1 };
  let ang = Math.atan2(h.y - neck.y, h.x - neck.x);
  if (Math.hypot(h.y - neck.y, h.x - neck.x) < 0.01) ang = 0;
  const hx = px(h);
  const hy = py(h);
  const headR = baseR * 1.14;

  ctx.fillStyle = skin.outline;
  ctx.beginPath();
  ctx.arc(hx, hy, headR + ow, 0, TAU);
  ctx.fill();
  ctx.fillStyle = skin.color(0, len, time);
  ctx.beginPath();
  ctx.arc(hx, hy, headR, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.arc(hx - headR * 0.25, hy - headR * 0.35, headR * 0.45, 0, TAU);
  ctx.fill();

  // Tongue flick.
  const tongueT = (time + look.blinkSeed * 0.37) % 2.6;
  if (look.alive && tongueT < 0.28) {
    const ext = Math.sin((tongueT / 0.28) * Math.PI) * cs * 0.38;
    const bx = hx + Math.cos(ang) * headR * 0.9;
    const by = hy + Math.sin(ang) * headR * 0.9;
    const tx = bx + Math.cos(ang) * ext;
    const ty = by + Math.sin(ang) * ext;
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = Math.max(1.5, cs * 0.06);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(tx, ty);
    ctx.lineTo(tx + Math.cos(ang + 0.6) * cs * 0.1, ty + Math.sin(ang + 0.6) * cs * 0.1);
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + Math.cos(ang - 0.6) * cs * 0.1, ty + Math.sin(ang - 0.6) * cs * 0.1);
    ctx.stroke();
  }

  // Eyes.
  const blink = (time + look.blinkSeed) % 3.7 < 0.13;
  const eyeR = cs * 0.15;
  for (const side of [-1, 1]) {
    const ea = ang + side * 0.95;
    const ex = hx + Math.cos(ea) * headR * 0.55;
    const ey = hy + Math.sin(ea) * headR * 0.55;
    if (!look.alive) {
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = Math.max(1.5, cs * 0.06);
      ctx.beginPath();
      const k = eyeR * 0.7;
      ctx.moveTo(ex - k, ey - k); ctx.lineTo(ex + k, ey + k);
      ctx.moveTo(ex + k, ey - k); ctx.lineTo(ex - k, ey + k);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    if (blink) ctx.ellipse(ex, ey, eyeR, eyeR * 0.18, ang, 0, TAU);
    else ctx.arc(ex, ey, eyeR, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (blink) continue;
    let la = ang;
    if (look.dizzy) la = time * 12 * side;
    else if (look.lookAt) la = Math.atan2(look.lookAt.y * cs + oy - ey, look.lookAt.x * cs + ox - ex);
    const pr = eyeR * 0.55;
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(ex + Math.cos(la) * eyeR * 0.38, ey + Math.sin(la) * eyeR * 0.38, pr, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex + Math.cos(la) * eyeR * 0.38 - pr * 0.35, ey + Math.sin(la) * eyeR * 0.38 - pr * 0.35, pr * 0.32, 0, TAU);
    ctx.fill();
  }

  // Hat.
  const hat = hatById(look.hat);
  if (hat.sprite) {
    const img = sprite(hat.sprite);
    if (img) {
      const size = cs * 1.05 * hat.scale;
      ctx.save();
      if (hat.place === 'eyes') {
        let rot = ang + Math.PI / 2;
        while (rot > Math.PI / 2) rot -= Math.PI;
        while (rot < -Math.PI / 2) rot += Math.PI;
        ctx.translate(hx + Math.cos(ang) * headR * 0.3, hy + Math.sin(ang) * headR * 0.3);
        ctx.rotate(rot);
        ctx.drawImage(img, -size / 2, -size / 2, size, size);
      } else {
        const wob = Math.sin(time * 6 + look.blinkSeed) * 0.06;
        ctx.translate(hx, hy - headR * 0.85);
        ctx.rotate(wob);
        ctx.drawImage(img, -size / 2, -size * 0.72, size, size);
      }
      ctx.restore();
    }
  }

  // Effects around the head.
  if (look.shield) {
    ctx.strokeStyle = `rgba(96,165,250,${0.55 + Math.sin(time * 8) * 0.25})`;
    ctx.lineWidth = Math.max(2, cs * 0.08);
    ctx.beginPath();
    ctx.arc(hx, hy, headR * 1.75, 0, TAU);
    ctx.stroke();
  }
  if (look.magnet) {
    ctx.save();
    ctx.strokeStyle = 'rgba(248,113,113,0.5)';
    ctx.setLineDash([cs * 0.25, cs * 0.25]);
    ctx.lineDashOffset = -time * cs * 2;
    ctx.lineWidth = Math.max(1.5, cs * 0.05);
    ctx.beginPath();
    ctx.arc(hx, hy, cs * (2.2 + Math.sin(time * 4) * 0.2), 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  if (look.name) {
    ctx.font = `700 ${Math.max(9, cs * 0.36)}px Rubik, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    const label = (look.leader ? '👑 ' : '') + look.name;
    ctx.strokeText(label, hx, hy - cs * 0.95);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, hx, hy - cs * 0.95);
  }
  ctx.restore();
}

// ─── Renderer ───────────────────────────────────────────────────────────────

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  engine: Engine;
  theme: ThemeDef;
  dpr = 1;
  cs = 20;
  ox = 0;
  oy = 0;
  width = 0;
  height = 0;
  particles: Particle[] = [];
  floaters: Floater[] = [];
  shake = 0;
  flash = 0;
  flashColor = '#ffffff';
  punch = 0;
  reducedFx = false;
  private bg: HTMLCanvasElement | null = null;
  private dark: HTMLCanvasElement | null = null;
  private stars: { x: number; y: number; s: number; p: number }[] = [];
  /** First time (seconds) each item was drawn, for the pop-in animation. */
  private seen = new Map<number, number>();

  constructor(canvas: HTMLCanvasElement, engine: Engine, themeId: string) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.engine = engine;
    this.theme = themeById(themeId);
  }

  static fit(cols: number, rows: number, maxW: number, maxH: number) {
    const cs = Math.max(6, Math.floor(Math.min(maxW / (cols + FRAME * 2), maxH / (rows + FRAME * 2))));
    return { cs, w: Math.round(cs * (cols + FRAME * 2)), h: Math.round(cs * (rows + FRAME * 2)) };
  }

  setEngine(engine: Engine) {
    this.engine = engine;
    this.particles = [];
    this.floaters = [];
    this.bg = null;
  }

  resize(cssW: number, cssH: number) {
    const { cols, rows } = this.engine;
    const fit = Renderer.fit(cols, rows, cssW, cssH);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cs = fit.cs;
    this.width = fit.w;
    this.height = fit.h;
    this.ox = FRAME * this.cs;
    this.oy = FRAME * this.cs;
    this.canvas.width = Math.round(fit.w * this.dpr);
    this.canvas.height = Math.round(fit.h * this.dpr);
    this.canvas.style.width = `${fit.w}px`;
    this.canvas.style.height = `${fit.h}px`;
    this.bg = null;
    return fit;
  }

  private buildBackground() {
    const { cols, rows } = this.engine;
    const { cs, theme } = this;
    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext('2d')!;
    g.scale(this.dpr, this.dpr);

    const W = this.width;
    const H = this.height;
    const rad = cs * 0.55;
    // Frame.
    g.fillStyle = theme.frame;
    roundRect(g, 0, 0, W, H, rad);
    g.fill();
    g.fillStyle = theme.frameLight;
    roundRect(g, 0, 0, W, H - cs * 0.12, rad);
    g.fill();

    // Tiles.
    g.save();
    roundRect(g, this.ox, this.oy, cols * cs, rows * cs, rad * 0.5);
    g.clip();
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        g.fillStyle = (x + y) % 2 === 0 ? theme.tileA : theme.tileB;
        g.fillRect(this.ox + x * cs, this.oy + y * cs, cs + 0.5, cs + 0.5);
      }
    }
    if (theme.grid) {
      g.strokeStyle = theme.grid;
      g.lineWidth = 1;
      g.beginPath();
      for (let x = 0; x <= cols; x++) { g.moveTo(this.ox + x * cs, this.oy); g.lineTo(this.ox + x * cs, this.oy + rows * cs); }
      for (let y = 0; y <= rows; y++) { g.moveTo(this.ox, this.oy + y * cs); g.lineTo(this.ox + cols * cs, this.oy + y * cs); }
      g.stroke();
    }
    // Decorations (deterministic).
    let seed = cols * 31 + rows * 17;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    if (theme.decor.length) {
      const count = Math.floor(cols * rows * 0.12);
      for (let i = 0; i < count; i++) {
        const x = this.ox + rnd() * cols * cs;
        const y = this.oy + rnd() * rows * cs;
        g.globalAlpha = theme.decorAlpha * (0.4 + rnd() * 0.6);
        g.fillStyle = theme.decor[Math.floor(rnd() * theme.decor.length)];
        const s = cs * (0.04 + rnd() * 0.07);
        if (theme.id === 'meadow' && rnd() < 0.35) {
          for (let k = 0; k < 5; k++) {
            g.beginPath();
            g.arc(x + Math.cos((k / 5) * TAU) * s * 1.4, y + Math.sin((k / 5) * TAU) * s * 1.4, s, 0, TAU);
            g.fill();
          }
          g.fillStyle = '#fde047';
        }
        g.beginPath();
        g.arc(x, y, s, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    // Inner shadow along the top edge.
    const grad = g.createLinearGradient(0, this.oy, 0, this.oy + cs * 0.6);
    grad.addColorStop(0, 'rgba(0,0,0,0.18)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(this.ox, this.oy, cols * cs, cs * 0.6);
    g.restore();

    this.bg = c;
    this.stars = [];
    if (theme.stars) {
      for (let i = 0; i < cols * rows * 0.05; i++) this.stars.push({ x: rnd() * cols, y: rnd() * rows, s: 0.03 + rnd() * 0.05, p: rnd() * TAU });
    }
  }

  // ─── Effects API ───────────────────────────────────────────────────────

  burst(x: number, y: number, color: string, count: number, speed = 4, shape: Shape = 'circle', size = 0.12, gravity = 0) {
    if (this.reducedFx) count = Math.ceil(count / 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const v = speed * (0.35 + Math.random() * 0.65);
      const max = 0.45 + Math.random() * 0.45;
      this.particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: max, max,
        size: size * (0.6 + Math.random() * 0.8), color, shape, gravity, spin: Math.random() * TAU,
      });
    }
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
  }

  ring(x: number, y: number, color: string, size = 1.4) {
    this.particles.push({ x, y, vx: 0, vy: 0, life: 0.45, max: 0.45, size, color, shape: 'ring', gravity: 0, spin: 0 });
  }

  float(x: number, y: number, text: string, color: string, size = 0.55) {
    this.floaters.push({ x, y, text, color, life: 1.1, max: 1.1, size });
  }

  onEvents(events: GameEvent[]) {
    const e = this.engine;
    for (const ev of events) {
      switch (ev.type) {
        case 'eat': {
          const cx = ev.x + 0.5;
          const cy = ev.y + 0.5;
          const color = ev.kind === 'power' ? POWERS[ev.power!].color : ev.kind === 'golden' ? '#fbbf24' : ev.kind === 'orb' ? '#fef08a' : FRUIT_COLORS[ev.sprite] ?? '#fde047';
          const isPlayer = e.snakes[ev.snake]?.controller !== 'bot';
          if (ev.kind === 'golden') {
            this.burst(cx, cy, '#fde047', 34, 7, 'star', 0.2);
            this.ring(cx, cy, '#fde047', 2.4);
            this.flash = 0.35; this.flashColor = '#fde68a';
            this.shake = Math.max(this.shake, 0.18);
          } else if (ev.kind === 'power') {
            this.burst(cx, cy, color, 26, 6, 'spark', 0.14);
            this.ring(cx, cy, color, 2.2);
            if (isPlayer) this.float(cx, cy - 0.4, POWERS[ev.power!].name + '!', color, 0.6);
          } else if (ev.kind === 'poison') {
            this.burst(cx, cy, '#a3e635', 24, 4, 'circle', 0.18, -2);
            if (isPlayer) this.float(cx, cy - 0.4, 'Бе-е! 🌀', '#a3e635', 0.6);
            this.shake = Math.max(this.shake, 0.15);
          } else if (ev.kind === 'key') {
            this.burst(cx, cy, '#fbbf24', 30, 6, 'star', 0.16);
            this.float(cx, cy - 0.4, 'Замки открыты!', '#fbbf24', 0.55);
          } else if (ev.kind === 'clock') {
            this.burst(cx, cy, '#f87171', 18, 5, 'spark', 0.12);
            this.float(cx, cy - 0.4, '+5 сек', '#fca5a5', 0.6);
          } else {
            this.burst(cx, cy, color, ev.kind === 'orb' ? 6 : 16, 5, ev.kind === 'coin' ? 'star' : 'circle', 0.13, 3);
            this.ring(cx, cy, color, 1.2);
          }
          if (isPlayer) {
            this.punch = Math.min(1, this.punch + 0.35);
            if (ev.points > 0 && ev.kind !== 'power') {
              this.float(cx, cy - 0.2, `+${ev.points}`, ev.combo >= 4 ? '#fde047' : '#ffffff', ev.combo >= 7 ? 0.75 : 0.55);
            }
            if (ev.combo >= 4 && ev.combo % 3 === 1) {
              const mult = 1 + Math.floor((ev.combo - 1) / 3);
              this.float(cx, cy - 1.1, `КОМБО ×${mult}`, '#f472b6', 0.7);
              this.shake = Math.max(this.shake, 0.12);
            }
          }
          break;
        }
        case 'die': {
          const s = e.snakes[ev.snake];
          const color = skinById(s.skin).preview[0];
          for (let i = 0; i < s.body.length; i += 1) {
            const b = s.body[i];
            this.burst(b.x + 0.5, b.y + 0.5, color, 4, 3.5, 'square', 0.16, 5);
          }
          this.burst(ev.x + 0.5, ev.y + 0.5, '#ffffff', 20, 7, 'spark', 0.12);
          this.shake = Math.max(this.shake, s.controller === 'bot' ? 0.2 : 0.55);
          if (s.controller !== 'bot') { this.flash = 0.35; this.flashColor = '#ef4444'; }
          break;
        }
        case 'kill': {
          const killer = e.snakes[ev.snake];
          const victim = e.snakes[ev.victim];
          if (killer?.controller === 'p1' && victim) {
            this.float(victim.body[0].x + 0.5, victim.body[0].y - 0.3, 'Съел! +100', '#f87171', 0.7);
          }
          break;
        }
        case 'shield':
          this.ring(ev.x + 0.5, ev.y + 0.5, '#60a5fa', 2.6);
          this.burst(ev.x + 0.5, ev.y + 0.5, '#93c5fd', 30, 6, 'spark', 0.14);
          this.float(ev.x + 0.5, ev.y - 0.3, 'Щит спас!', '#93c5fd', 0.6);
          this.shake = Math.max(this.shake, 0.35);
          break;
        case 'portal': {
          const p = e.portalAt(ev.x2, ev.y2);
          const color = p?.portal.color ?? '#a855f7';
          this.burst(ev.x2 + 0.5, ev.y2 + 0.5, color, 14, 4, 'spark', 0.12);
          this.ring(ev.x2 + 0.5, ev.y2 + 0.5, color, 1.6);
          break;
        }
        case 'unlock':
          this.burst(ev.x + 0.5, ev.y + 0.5, '#fde68a', 14, 4, 'star', 0.14);
          break;
        case 'rock':
          this.burst(ev.x + 0.5, ev.y + 0.5, '#a8a29e', 14, 3, 'circle', 0.16, 4);
          this.shake = Math.max(this.shake, 0.12);
          break;
        case 'respawn': {
          const s = e.snakes[ev.snake];
          this.ring(s.body[0].x + 0.5, s.body[0].y + 0.5, '#ffffff', 2);
          break;
        }
        case 'win':
          this.flash = 0.4; this.flashColor = '#fef08a';
          break;
      }
    }
  }

  // ─── Frame ─────────────────────────────────────────────────────────────

  render(dt: number, time: number) {
    const { ctx, engine, cs } = this;
    if (!this.bg) this.buildBackground();
    const sec = time / 1000;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    const shakeMag = this.reducedFx ? 0 : this.shake * cs * 0.6;
    const sx = (Math.random() - 0.5) * shakeMag;
    const sy = (Math.random() - 0.5) * shakeMag;
    this.shake = Math.max(0, this.shake - dt / 1000 * 1.6);
    const punch = this.reducedFx ? 0 : this.punch;
    this.punch = Math.max(0, this.punch - dt / 1000 * 4);

    ctx.save();
    const scale = 1 + punch * 0.012;
    ctx.translate(this.width / 2 + sx, this.height / 2 + sy);
    ctx.scale(scale, scale);
    ctx.translate(-this.width / 2, -this.height / 2);

    ctx.drawImage(this.bg!, 0, 0, this.width, this.height);

    // Clip everything else to the board.
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.ox, this.oy, engine.cols * cs, engine.rows * cs);
    ctx.clip();

    if (this.stars.length) {
      for (const st of this.stars) {
        ctx.globalAlpha = 0.35 + Math.sin(sec * 2 + st.p) * 0.35;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.ox + st.x * cs, this.oy + st.y * cs, st.s * cs, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    this.drawCells(sec);
    this.drawPortals(sec);
    this.drawItems(sec);
    this.drawSnakes(sec);
    this.drawParticles(dt);
    if (engine.mutators.has('dark')) this.drawDarkness(sec);
    this.drawFloaters(dt);

    ctx.restore();
    ctx.restore();

    if (this.flash > 0.01) {
      ctx.globalAlpha = this.flash;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.globalAlpha = 1;
      this.flash *= Math.pow(0.02, dt / 1000);
    }
  }

  private drawCells(sec: number) {
    const { ctx, engine, cs } = this;
    const rockImg = sprite(this.theme.rock);
    const lockImg = sprite('locked');
    for (let i = 0; i < engine.cells.length; i++) {
      const c = engine.cells[i];
      if (c === 0) continue;
      const x = this.ox + (i % engine.cols) * cs;
      const y = this.oy + Math.floor(i / engine.cols) * cs;
      if (c === CELL_ROCK) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.ellipse(x + cs * 0.55, y + cs * 0.85, cs * 0.42, cs * 0.14, 0, 0, TAU);
        ctx.fill();
        if (rockImg) ctx.drawImage(rockImg, x - cs * 0.04, y - cs * 0.08, cs * 1.08, cs * 1.08);
        else {
          ctx.fillStyle = '#78716c';
          roundRect(ctx, x + cs * 0.08, y + cs * 0.08, cs * 0.84, cs * 0.84, cs * 0.2);
          ctx.fill();
        }
      } else if (c === CELL_LOCK) {
        ctx.fillStyle = this.theme.frame;
        roundRect(ctx, x + cs * 0.04, y + cs * 0.04, cs * 0.92, cs * 0.92, cs * 0.18);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        roundRect(ctx, x + cs * 0.04, y + cs * 0.04, cs * 0.92, cs * 0.4, cs * 0.18);
        ctx.fill();
        const bob = Math.sin(sec * 3 + i) * cs * 0.03;
        if (lockImg) ctx.drawImage(lockImg, x + cs * 0.14, y + cs * 0.12 + bob, cs * 0.72, cs * 0.72);
      }
    }
  }

  private drawPortals(sec: number) {
    const { ctx, cs } = this;
    for (const p of this.engine.portals) {
      for (const end of [p.a, p.b]) {
        const cx = this.ox + (end.x + 0.5) * cs;
        const cy = this.oy + (end.y + 0.5) * cs;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cs * 0.6);
        g.addColorStop(0, '#0b0620');
        g.addColorStop(0.55, p.color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, cs * 0.62, 0, TAU);
        ctx.fill();
        ctx.lineWidth = Math.max(1.5, cs * 0.07);
        ctx.lineCap = 'round';
        for (let k = 0; k < 3; k++) {
          ctx.strokeStyle = k === 0 ? '#ffffff' : p.color;
          ctx.globalAlpha = 0.85 - k * 0.2;
          ctx.beginPath();
          const r = cs * (0.22 + k * 0.1);
          const start = sec * (3 - k) * (k % 2 ? -1 : 1) + k;
          ctx.arc(cx, cy, r, start, start + Math.PI * 1.2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  private drawItems(sec: number) {
    const { ctx, cs, engine } = this;
    for (const it of engine.items) {
      const cx = this.ox + (it.x + 0.5) * cs;
      const cy = this.oy + (it.y + 0.5) * cs;
      let first = this.seen.get(it.id);
      if (first === undefined) {
        first = sec;
        this.seen.set(it.id, sec);
        if (this.seen.size > 400) this.seen.clear();
      }
      const age = sec - first;
      const pop = age < 0.35 ? easeOutBack(Math.max(0, age) / 0.35) : 1;
      if (it.ttl !== undefined && it.ttl < 2200 && Math.floor(it.ttl / 120) % 2 === 0) continue;
      const bob = Math.sin(sec * 4 + it.id) * cs * 0.05;

      if (it.kind === 'orb') {
        const r = cs * 0.2 * pop * (1 + Math.sin(sec * 6 + it.id) * 0.12);
        ctx.shadowColor = it.color ?? '#fff';
        ctx.shadowBlur = cs * 0.5;
        ctx.fillStyle = it.color ?? '#fff';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.35, 0, TAU);
        ctx.fill();
        continue;
      }

      // Shadow.
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + cs * 0.36, cs * 0.3 * pop, cs * 0.09 * pop, 0, 0, TAU);
      ctx.fill();

      if (it.kind === 'golden' || it.kind === 'key') {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(sec * 1.2);
        ctx.fillStyle = it.kind === 'golden' ? 'rgba(253,224,71,0.35)' : 'rgba(251,191,36,0.3)';
        for (let k = 0; k < 8; k++) {
          ctx.rotate(TAU / 8);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(cs * 0.9, -cs * 0.12);
          ctx.lineTo(cs * 0.9, cs * 0.12);
          ctx.fill();
        }
        ctx.restore();
      }

      if (it.kind === 'power') {
        const color = POWERS[it.power!].color;
        const pulse = 1 + Math.sin(sec * 5 + it.id) * 0.06;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(cx, cy + bob, cs * 0.52 * pop * pulse, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1.5, cs * 0.06);
        ctx.beginPath();
        ctx.arc(cx, cy + bob, cs * 0.46 * pop * pulse, 0, TAU);
        ctx.stroke();
      }

      const img = sprite(it.kind === 'golden' ? 'golden' : it.sprite);
      const size = cs * (it.kind === 'power' ? 0.66 : it.kind === 'coin' ? 0.72 : 0.86) * pop;
      if (img) {
        const squish = 1 + Math.sin(sec * 8 + it.id) * 0.03;
        ctx.drawImage(img, cx - (size * squish) / 2, cy - size / 2 + bob - cs * 0.04, size * squish, size / squish);
      }

      if (it.ttl !== undefined && it.maxTtl) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = Math.max(1.5, cs * 0.05);
        ctx.beginPath();
        ctx.arc(cx, cy, cs * 0.5, -Math.PI / 2, -Math.PI / 2 + TAU * (it.ttl / it.maxTtl));
        ctx.stroke();
      }
    }
  }

  private snakeChunks(s: Snake, t: number): Pt[][] {
    const { engine } = this;
    const chunks: Pt[][] = [];
    let cur: Pt[] = [];
    let prevPt: Pt | null = null;
    const body = s.body;
    for (let i = 0; i < body.length; i++) {
      const b = body[i];
      const pb = s.prevBody[i] ?? s.prevBody[s.prevBody.length - 1] ?? b;
      let x: number;
      let y: number;
      const jump = Math.abs(b.x - pb.x) + Math.abs(b.y - pb.y) > 1;
      if (jump) {
        if (i === 0) {
          // Slide in from behind along the travel direction.
          x = b.x - DX[s.dir] * (1 - t);
          y = b.y - DY[s.dir] * (1 - t);
        } else {
          x = b.x;
          y = b.y;
        }
      } else {
        x = pb.x + (b.x - pb.x) * t;
        y = pb.y + (b.y - pb.y) * t;
      }
      const pt: Pt = { x: x + 0.5, y: y + 0.5, seg: i };
      if (prevPt && Math.abs(pt.x - prevPt.x) + Math.abs(pt.y - prevPt.y) > 1.6) {
        // Wrap: extend both ends past the edge so the body appears to cross it.
        const dx = pt.x - prevPt.x;
        const dy = pt.y - prevPt.y;
        const wrapX = Math.abs(dx) > engine.cols / 2;
        const wrapY = Math.abs(dy) > engine.rows / 2;
        if (wrapX || wrapY) {
          const ux = wrapX ? -Math.sign(dx) : 0;
          const uy = wrapY ? -Math.sign(dy) : 0;
          cur.push({ x: prevPt.x + ux, y: prevPt.y + uy, seg: prevPt.seg + 0.5 });
          chunks.push(cur);
          cur = [{ x: pt.x - ux, y: pt.y - uy, seg: pt.seg - 0.5 }];
        } else {
          chunks.push(cur);
          cur = [];
        }
      }
      cur.push(pt);
      prevPt = pt;
    }
    if (cur.length) chunks.push(cur);
    return chunks;
  }

  private drawSnakes(sec: number) {
    const { engine, ctx, cs } = this;
    const leader = engine.cfg.mode === 'arena'
      ? engine.snakes.filter((s) => s.alive).reduce<Snake | null>((a, b) => (!a || b.score > a.score ? b : a), null)
      : null;

    for (const s of engine.snakes) {
      let alpha = 1;
      if (!s.alive) {
        const since = (engine.time - s.deadTime) / 1000;
        if (engine.phase === 'dying' || engine.phase === 'over' || engine.phase === 'roundOver') alpha = s.controller === 'bot' ? Math.max(0, 1 - since * 1.5) : 1;
        else alpha = Math.max(0, 1 - since * 2.2);
        if (alpha <= 0) continue;
      }
      if (s.invuln > 0 && Math.floor(s.invuln / 110) % 2 === 0) alpha *= 0.4;

      const step = engine.effectiveStep(s);
      const chunks = this.snakeChunks(s, s.alive ? Math.min(1, s.moveAcc / step) : 1);

      let lookAt: { x: number; y: number } | undefined;
      const head = s.body[0];
      let bestD = 1e9;
      for (const it of engine.items) {
        const d = Math.abs(it.x - head.x) + Math.abs(it.y - head.y);
        if (d < bestD && it.kind !== 'poison') { bestD = d; lookAt = { x: it.x + 0.5, y: it.y + 0.5 }; }
      }

      if (s.effects.turbo && s.alive && Math.random() < 0.5) {
        const tail = s.body[s.body.length - 1];
        this.burst(tail.x + 0.5, tail.y + 0.5, '#fde047', 1, 1.5, 'spark', 0.1);
      }
      if (s.effects.freeze && s.alive && Math.random() < 0.3) {
        const b = s.body[Math.floor(Math.random() * s.body.length)];
        this.burst(b.x + 0.5, b.y + 0.5, '#e0f2fe', 1, 0.8, 'star', 0.1, -1);
      }

      drawSnakeShape(ctx, chunks, s.body.length, cs, this.ox, this.oy, {
        skin: skinById(s.skin),
        hat: s.hat,
        time: sec,
        alpha,
        alive: s.alive,
        gulps: s.gulps,
        lookAt,
        dizzy: s.reversed > 0,
        shield: s.shield,
        ghost: !!s.effects.ghost,
        turbo: !!s.effects.turbo,
        magnet: !!s.effects.magnet,
        freeze: !!s.effects.freeze,
        blinkSeed: s.id * 1.7,
        name: engine.cfg.mode === 'arena' || engine.cfg.mode === 'duel' || engine.rivalId >= 0 ? s.name : undefined,
        leader: leader === s && engine.cfg.mode === 'arena',
      });
    }
  }

  private drawParticles(dt: number) {
    const { ctx, cs } = this;
    const k = dt / 1000;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= k;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vx *= Math.pow(0.08, k);
      p.vy *= Math.pow(0.08, k);
      p.vy += p.gravity * k;
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.spin += k * 6;
      const f = p.life / p.max;
      const x = this.ox + p.x * cs;
      const y = this.oy + p.y * cs;
      ctx.globalAlpha = Math.min(1, f * 1.6);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      const size = p.size * cs * (p.shape === 'ring' ? 1 : 0.4 + f * 0.6);
      switch (p.shape) {
        case 'ring':
          ctx.lineWidth = Math.max(1.5, cs * 0.1 * f);
          ctx.beginPath();
          ctx.arc(x, y, size * (1 - f) + cs * 0.2, 0, TAU);
          ctx.stroke();
          break;
        case 'star':
          drawStar(ctx, x, y, size * 1.4, p.spin);
          break;
        case 'spark':
          ctx.lineWidth = Math.max(1, size * 0.6);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - p.vx * cs * 0.04, y - p.vy * cs * 0.04);
          ctx.stroke();
          break;
        case 'square':
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(p.spin);
          ctx.fillRect(-size / 2, -size / 2, size, size);
          ctx.restore();
          break;
        default:
          ctx.beginPath();
          ctx.arc(x, y, size, 0, TAU);
          ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawFloaters(dt: number) {
    const { ctx, cs } = this;
    const k = dt / 1000;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= k;
      if (f.life <= 0) {
        this.floaters.splice(i, 1);
        continue;
      }
      f.y -= k * 1.1;
      const age = 1 - f.life / f.max;
      const scale = age < 0.15 ? easeOutBack(age / 0.15) : 1;
      ctx.globalAlpha = Math.min(1, (f.life / f.max) * 2.5);
      const size = Math.max(11, f.size * cs) * scale;
      ctx.font = `800 ${size}px Unbounded, Rubik, sans-serif`;
      const x = Math.min(Math.max(this.ox + f.x * cs, this.ox + size * 2), this.ox + this.engine.cols * cs - size * 2);
      const y = this.oy + f.y * cs;
      ctx.lineWidth = Math.max(3, size * 0.22);
      ctx.strokeStyle = 'rgba(15,23,42,0.85)';
      ctx.lineJoin = 'round';
      ctx.strokeText(f.text, x, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, x, y);
    }
    ctx.globalAlpha = 1;
  }

  private drawDarkness(sec: number) {
    const { engine, cs } = this;
    if (!this.dark || this.dark.width !== this.canvas.width) {
      this.dark = document.createElement('canvas');
      this.dark.width = this.canvas.width;
      this.dark.height = this.canvas.height;
    }
    const g = this.dark.getContext('2d')!;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, this.width, this.height);
    g.fillStyle = 'rgba(6, 6, 24, 0.94)';
    g.fillRect(0, 0, this.width, this.height);
    g.globalCompositeOperation = 'destination-out';
    const hole = (x: number, y: number, r: number, strength: number) => {
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(0,0,0,${strength})`);
      grad.addColorStop(0.6, `rgba(0,0,0,${strength * 0.85})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    };
    for (const s of engine.snakes) {
      if (!s.alive) continue;
      const h = s.body[0];
      const r = cs * (s.controller === 'bot' ? 1.6 : 4.2 + Math.sin(sec * 3) * 0.15);
      hole(this.ox + (h.x + 0.5) * cs, this.oy + (h.y + 0.5) * cs, r, 1);
    }
    for (const it of engine.items) {
      hole(this.ox + (it.x + 0.5) * cs, this.oy + (it.y + 0.5) * cs, cs * (0.9 + Math.sin(sec * 4 + it.id) * 0.15), 0.6);
    }
    for (const p of engine.portals) {
      for (const e of [p.a, p.b]) hole(this.ox + (e.x + 0.5) * cs, this.oy + (e.y + 0.5) * cs, cs * 0.9, 0.5);
    }
    this.ctx.drawImage(this.dark, 0, 0, this.width, this.height);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = rot + (i / 10) * TAU;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

export function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/** Animated snake for the shop / home previews. */
export function drawPreviewSnake(ctx: CanvasRenderingContext2D, w: number, h: number, skinId: string, hatId: string, time: number) {
  const segs = 11;
  const cs = Math.min(w / 7.5, h / 3.2);
  const pts: Pt[] = [];
  for (let i = 0; i < segs; i++) {
    const x = 6.2 - i * 0.52;
    const y = 1.6 + Math.sin(i * 0.65 - time * 3.2) * 0.55;
    pts.push({ x, y, seg: i });
  }
  const ox = (w - 7 * cs) / 2;
  const oy = (h - 3.2 * cs) / 2;
  drawSnakeShape(ctx, [pts], segs, cs, ox, oy, {
    skin: skinById(skinId), hat: hatId, time, alpha: 1, alive: true, gulps: [], blinkSeed: 0,
    lookAt: { x: 8, y: 1.6 },
  });
}

export type { Item };
