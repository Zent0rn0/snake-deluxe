import { AnimatePresence, motion } from 'framer-motion';
import { useSyncExternalStore } from 'react';
import { audio } from '../audio/audio';
import type { AchievementDef } from '../store/profile';
import { Emoji } from './kit';

interface Toast {
  id: number;
  sprite: string;
  title: string;
  text: string;
  reward?: number;
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function pushToast(t: Omit<Toast, 'id'>) {
  const toast = { ...t, id: nextId++ };
  toasts = [...toasts, toast];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== toast.id);
    emit();
  }, 3600);
}

export function toastAchievements(list: AchievementDef[]) {
  list.forEach((a, i) => {
    setTimeout(() => {
      audio.achievement();
      pushToast({ sprite: a.sprite, title: 'Достижение!', text: a.name, reward: a.reward });
    }, i * 700);
  });
}

export function Toasts() {
  const list = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => toasts,
  );
  return (
    <div className="fixed top-[max(env(safe-area-inset-top),12px)] inset-x-0 z-[60] flex flex-col items-center gap-2 pointer-events-none px-4">
      <AnimatePresence>
        {list.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ y: -40, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="glass-strong rounded-2xl pl-2 pr-4 py-2 flex items-center gap-3 shadow-2xl max-w-sm w-full"
          >
            <div className="w-12 h-12 rounded-xl grid place-items-center bg-gradient-to-br from-amber-300/30 to-fuchsia-400/20">
              <Emoji name={t.sprite} size={36} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-widest text-amber-300 font-bold">{t.title}</div>
              <div className="font-display font-bold truncate">{t.text}</div>
            </div>
            {t.reward ? (
              <div className="flex items-center gap-1 font-display font-bold text-amber-200">
                +{t.reward}
                <Emoji name="coin" size={20} />
              </div>
            ) : null}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
