import { animate } from 'framer-motion';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

/** Animates a number towards `value` so scores and coin counts tick up. */
export function useCountUp(value: number, duration = 0.6) {
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setShown(Math.round(v)),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, duration]);
  return shown;
}

// ─── Viewport ───────────────────────────────────────────────────────────────

export interface Viewport {
  w: number;
  h: number;
  portrait: boolean;
  landscape: boolean;
  /** A landscape phone: too little height for stacked chrome. */
  short: boolean;
  /** A real touch device. `ontouchstart` is also true on touch-capable laptops. */
  coarse: boolean;
  device: 'phone' | 'tablet' | 'desktop';
}

const EMPTY: Viewport = {
  w: 1024,
  h: 768,
  portrait: false,
  landscape: true,
  short: false,
  coarse: false,
  device: 'desktop',
};

function measure(): Viewport {
  const vv = window.visualViewport;
  // visualViewport is the only source that stays correct while the iOS URL bar
  // slides in and out.
  const w = Math.round(vv?.width ?? window.innerWidth);
  const h = Math.round(vv?.height ?? window.innerHeight);
  const coarse = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const portrait = h >= w;
  const device = w >= 1024 && !coarse ? 'desktop' : Math.min(w, h) >= 600 ? 'tablet' : 'phone';
  return { w, h, portrait, landscape: !portrait, short: h < 480, coarse, device };
}

let current: Viewport = EMPTY;
let started = false;
const listeners = new Set<() => void>();

function publish() {
  const next = measure();
  if (next.w === current.w && next.h === current.h && next.coarse === current.coarse && next.device === current.device) {
    return;
  }
  current = next;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  if (!started) {
    started = true;
    current = measure();
  }
  listeners.add(cb);
  if (listeners.size === 1) {
    // One coalesced handler for every source that can change the viewport.
    window.addEventListener('resize', onChange, { passive: true });
    window.addEventListener('orientationchange', onChange, { passive: true });
    window.visualViewport?.addEventListener('resize', onChange, { passive: true });
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) {
      window.removeEventListener('resize', onChange);
      window.removeEventListener('orientationchange', onChange);
      window.visualViewport?.removeEventListener('resize', onChange);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }
  };
}

let raf = 0;
function onChange() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    publish();
  });
}

/**
 * Viewport size, orientation and input class, from a single shared listener.
 * Prefer this over ad-hoc `window.innerWidth` reads — those never update.
 */
export function useViewport(): Viewport {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => EMPTY,
  );
}
