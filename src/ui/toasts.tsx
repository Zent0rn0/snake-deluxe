import { AnimatePresence, motion } from 'framer-motion';
import { useSyncExternalStore } from 'react';
import { getToasts, subscribeToasts } from './toastStore';
import { Emoji } from './kit';

export function Toasts() {
  const list = useSyncExternalStore(subscribeToasts, getToasts, getToasts);
  return (
    <div className="fixed top-[max(var(--sat),12px)] inset-x-0 safe-x z-[60] flex flex-col items-center gap-2 pointer-events-none px-4">
      <AnimatePresence>
        {list.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ y: -32, opacity: 0, scale: 0.94 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -16, opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="glass-strong rounded-card pl-2 pr-4 py-2 flex items-center gap-3 max-w-sm w-full"
          >
            <div className="w-12 h-12 rounded-sm grid place-items-center bg-reward/15 border border-reward/25">
              <Emoji name={t.sprite} size={34} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-widest text-reward font-bold">{t.title}</div>
              <div className="font-display font-bold truncate">{t.text}</div>
            </div>
            {t.reward ? (
              <div className="flex items-center gap-1 font-display font-bold text-reward-soft">
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
