import type { Engine } from './engine';
import { opposite, type Dir, type Snake } from './types';

const LEFT_OF = (d: Dir): Dir => ((d + 3) % 4) as Dir;
const RIGHT_OF = (d: Dir): Dir => ((d + 1) % 4) as Dir;

interface Candidate {
  dir: Dir;
  idx: number;
  space: number;
  risky: boolean;
}

/**
 * Bot brain: BFS toward the nearest tasty item, but only if the move keeps
 * enough free space around (flood fill) so the bot doesn't trap itself.
 * `botLevel` 0..3 controls mistakes and aggression.
 */
export function decideBotMove(engine: Engine, s: Snake): Dir {
  const W = engine.cols;
  const H = engine.rows;
  const size = W * H;
  const ghost = !!s.effects.ghost || s.invuln > 0;
  const rng = engine.rng;

  const blocked = new Uint8Array(size);
  const danger = new Uint8Array(size);
  for (let i = 0; i < size; i++) if (engine.cells[i] !== 0) blocked[i] = 1;
  for (const o of engine.snakes) {
    if (!o.alive) continue;
    const len = o.grow === 0 ? o.body.length - 1 : o.body.length;
    for (let j = 0; j < len; j++) {
      const b = o.body[j];
      if (o === s && engine.mutators.has('cheese')) continue;
      blocked[b.y * W + b.x] = 1;
    }
    if (o !== s && s.botLevel >= 1) {
      for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
        const n = engine.nextCell(o.body[0].x, o.body[0].y, d);
        if (n) danger[n.y * W + n.x] = 1;
      }
    }
  }
  for (const it of engine.items) {
    if (it.kind === 'poison' && s.botLevel >= 1) blocked[it.y * W + it.x] = 1;
  }

  const flood = (start: number, limit: number) => {
    const seen = new Uint8Array(size);
    const stack = [start];
    seen[start] = 1;
    let count = 0;
    while (stack.length && count < limit) {
      const c = stack.pop()!;
      count++;
      const cx = c % W;
      const cy = (c - cx) / W;
      for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
        const n = engine.nextCell(cx, cy, d);
        if (!n) continue;
        const ni = n.y * W + n.x;
        if (seen[ni] || blocked[ni]) continue;
        seen[ni] = 1;
        stack.push(ni);
      }
    }
    return count;
  };

  const head = s.body[0];
  const need = s.body.length + 4;
  const candidates: Candidate[] = [];
  for (const d of [s.dir, LEFT_OF(s.dir), RIGHT_OF(s.dir)]) {
    if (d === opposite(s.dir)) continue;
    const n = engine.nextCell(head.x, head.y, d, engine.wrap || ghost);
    if (!n) continue;
    const ni = n.y * W + n.x;
    if (blocked[ni] && !ghost) continue;
    candidates.push({ dir: d, idx: ni, space: flood(ni, need * 2), risky: danger[ni] === 1 });
  }
  if (!candidates.length) return s.dir;

  const safe = candidates.filter((c) => c.space >= need && !c.risky);
  const mistakeChance = [0.14, 0.05, 0.015, 0][Math.min(3, s.botLevel)];
  if (safe.length && rng.chance(mistakeChance)) return rng.pick(safe).dir;

  // Targets: tasty items, or (for aggressive bots) the cell in front of the player.
  const targets = new Map<number, number>();
  for (const it of engine.items) {
    if (it.kind === 'poison') continue;
    const worth = it.kind === 'golden' ? 3 : it.kind === 'power' ? (s.botLevel >= 2 ? 2 : 0.5) : it.kind === 'orb' ? 1.4 : 1;
    targets.set(it.y * W + it.x, worth);
  }
  if (s.botLevel >= 2 && engine.cfg.mode === 'arena') {
    const p = engine.player;
    if (p && p.alive && p.body.length < s.body.length + 6) {
      const ahead = engine.nextCell(p.body[0].x, p.body[0].y, p.dir);
      const ahead2 = ahead && engine.nextCell(ahead.x, ahead.y, p.dir);
      if (ahead2) {
        const d = Math.abs(ahead2.x - head.x) + Math.abs(ahead2.y - head.y);
        if (d < 7) targets.set(ahead2.y * W + ahead2.x, 2.5);
      }
    }
  }

  // Multi-source BFS starting from each candidate cell, remembering the first move.
  const firstDir = new Int8Array(size).fill(-1);
  const dist = new Uint16Array(size);
  const queue: number[] = [];
  for (const c of candidates) {
    if (firstDir[c.idx] !== -1) continue;
    firstDir[c.idx] = c.dir;
    dist[c.idx] = 1;
    queue.push(c.idx);
  }
  let best: { dir: Dir; score: number } | null = null;
  for (let qi = 0; qi < queue.length; qi++) {
    const c = queue[qi];
    const worth = targets.get(c);
    if (worth) {
      const score = worth / dist[c];
      if (!best || score > best.score) best = { dir: firstDir[c] as Dir, score };
      if (dist[c] > 18) break;
    }
    if (best && dist[c] > 1 / best.score * 3) break;
    const cx = c % W;
    const cy = (c - cx) / W;
    for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
      const n = engine.nextCell(cx, cy, d);
      if (!n) continue;
      const ni = n.y * W + n.x;
      if (firstDir[ni] !== -1 || blocked[ni]) continue;
      firstDir[ni] = firstDir[c];
      dist[ni] = dist[c] + 1;
      queue.push(ni);
    }
  }

  if (best) {
    const chosen = candidates.find((c) => c.dir === best!.dir);
    if (chosen && chosen.space >= need && (!chosen.risky || s.botLevel === 0)) return chosen.dir;
  }

  // No good target: survive. Prefer safe, roomy, then straight.
  candidates.sort((a, b) => {
    if (a.risky !== b.risky) return a.risky ? 1 : -1;
    if (Math.min(a.space, need) !== Math.min(b.space, need)) return b.space - a.space;
    if (a.dir === s.dir) return -1;
    if (b.dir === s.dir) return 1;
    return rng.next() - 0.5;
  });
  return candidates[0].dir;
}
