import { useEffect, useRef, type RefObject } from 'react';
import type { ControlScheme } from '../store/profile';
import { opposite, type Dir } from '../game/types';

export interface GameInputOptions {
  scheme: ControlScheme;
  /** 0..1 — maps to an 18px..8px swipe threshold. */
  sensitivity: number;
  enabled: boolean;
  /** Absolute turn, from a swipe or the joystick. */
  onDir: (dir: Dir) => void;
  /** Relative turn for the one-thumb tap scheme: -1 left, +1 right. */
  onRelative: (delta: -1 | 1) => void;
  /** Optional element the joystick ring is positioned through, imperatively. */
  joystickRef?: RefObject<HTMLDivElement | null>;
}

/** Two turns cannot land closer together than this. Shorter than any step. */
const FIRE_COOLDOWN_MS = 40;
/** A reversal this soon after a turn is thumb wobble, not intent. */
const REVERSAL_GUARD_MS = 120;
/**
 * A drag only counts as horizontal (or vertical) when one axis clearly wins.
 * Without this a diagonal drag crosses both thresholds in turn and fires
 * up, right, up, right — the zig-zag players complain about.
 */
const AXIS_DOMINANCE = 1.5;
const JOYSTICK_DEADZONE = 14;

function dirFrom(dx: number, dy: number): Dir | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax > ay * AXIS_DOMINANCE) return dx > 0 ? 1 : 3;
  if (ay > ax * AXIS_DOMINANCE) return dy > 0 ? 2 : 0;
  return null;
}

/**
 * Touch steering for the game board.
 *
 * Native listeners on the whole screen rather than React handlers on the board:
 * React treats `pointermove` as a deferrable continuous event, JSX cannot pass
 * `{ passive: false }`, and a board-only handler leaves the HUD strip and the
 * bottom of the screen — where the thumb naturally rests — completely dead.
 */
export function useGameInput(rootRef: RefObject<HTMLElement | null>, opts: GameInputOptions) {
  const ref = useRef(opts);
  ref.current = opts;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let active: number | null = null;
    let ax = 0;
    let ay = 0;
    let originX = 0;
    let originY = 0;
    let moved = 0;
    let lastFire = 0;
    let lastDir: Dir | null = null;

    const threshold = () => 18 - Math.max(0, Math.min(1, ref.current.sensitivity)) * 10;

    const fire = (dir: Dir) => {
      const now = performance.now();
      if (now - lastFire < FIRE_COOLDOWN_MS) return;
      if (lastDir !== null && dir === opposite(lastDir) && now - lastFire < REVERSAL_GUARD_MS) return;
      lastFire = now;
      lastDir = dir;
      ref.current.onDir(dir);
    };

    const placeJoystick = (x: number, y: number, visible: boolean) => {
      const el = ref.current.joystickRef?.current;
      if (!el) return;
      el.style.opacity = visible ? '1' : '0';
      if (visible) el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    };

    const down = (ev: PointerEvent) => {
      const o = ref.current;
      if (!o.enabled || o.scheme === 'dpad') return;
      if (ev.pointerType === 'mouse') return;
      // Buttons and dialogs opt out so a tap on Pause is never read as a turn.
      if ((ev.target as HTMLElement | null)?.closest('[data-no-swipe]')) return;
      active = ev.pointerId;
      ax = originX = ev.clientX;
      ay = originY = ev.clientY;
      moved = 0;
      // Capture so the gesture survives the finger leaving the board.
      try {
        root.setPointerCapture(ev.pointerId);
      } catch {
        /* capture is best-effort */
      }
      if (o.scheme === 'joystick') placeJoystick(ev.clientX, ev.clientY, true);
    };

    const handle = (x: number, y: number) => {
      const o = ref.current;
      if (o.scheme === 'joystick') {
        const dir = dirFrom(x - originX, y - originY);
        if (dir !== null && Math.hypot(x - originX, y - originY) >= JOYSTICK_DEADZONE) fire(dir);
        return;
      }
      // swipe: re-anchor after each turn so a held drag keeps steering.
      const dx = x - ax;
      const dy = y - ay;
      if (Math.hypot(dx, dy) < threshold()) return;
      const dir = dirFrom(dx, dy);
      if (dir === null) return;
      fire(dir);
      ax = x;
      ay = y;
    };

    const move = (ev: PointerEvent) => {
      const o = ref.current;
      if (!o.enabled || active !== ev.pointerId) return;
      if (o.scheme === 'tap') {
        moved = Math.max(moved, Math.hypot(ev.clientX - originX, ev.clientY - originY));
        return;
      }
      ev.preventDefault();
      // Coalesced samples expose what a 120Hz digitizer recorded between
      // frames, so a fast flick registers on the sample it actually crossed.
      const events = typeof ev.getCoalescedEvents === 'function' ? ev.getCoalescedEvents() : [];
      if (events.length > 1) {
        for (const e of events) handle(e.clientX, e.clientY);
      } else {
        handle(ev.clientX, ev.clientY);
      }
      if (o.scheme === 'joystick') placeJoystick(originX, originY, true);
    };

    const up = (ev: PointerEvent) => {
      const o = ref.current;
      if (active !== ev.pointerId) return;
      active = null;
      try {
        root.releasePointerCapture(ev.pointerId);
      } catch {
        /* capture is best-effort */
      }
      placeJoystick(0, 0, false);
      if (!o.enabled || o.scheme !== 'tap') return;
      if (moved > 16) return; // a drag, not a tap
      if ((ev.target as HTMLElement | null)?.closest('[data-no-swipe]')) return;
      const half = root.getBoundingClientRect().width / 2;
      o.onRelative(ev.clientX - root.getBoundingClientRect().left < half ? -1 : 1);
    };

    root.addEventListener('pointerdown', down, { passive: false });
    root.addEventListener('pointermove', move, { passive: false });
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', up);
    return () => {
      root.removeEventListener('pointerdown', down);
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerup', up);
      root.removeEventListener('pointercancel', up);
    };
  }, [rootRef]);
}
