import { motion, AnimatePresence, animate } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { emojiUrl } from '../game/assets';
import { audio } from '../audio/audio';
import { useProfile } from '../store/profile';

export function Emoji({ name, size = 32, className = '', style }: { name: string; size?: number; className?: string; style?: CSSProperties }) {
  return (
    <img
      src={emojiUrl(name)}
      width={size}
      height={size}
      alt=""
      draggable={false}
      className={`inline-block shrink-0 drop-shadow-[0_4px_6px_rgba(0,0,0,0.35)] ${className}`}
      style={{ width: size, height: size, ...style }}
    />
  );
}

const TONES = {
  green: ['#22c55e', '#15803d'],
  gold: ['#f59e0b', '#b45309'],
  blue: ['#3b82f6', '#1d4ed8'],
  pink: ['#ec4899', '#be185d'],
  purple: ['#8b5cf6', '#6d28d9'],
  red: ['#ef4444', '#b91c1c'],
  slate: ['#475569', '#1e293b'],
} as const;

export type Tone = keyof typeof TONES;

export function Button({
  children, onClick, tone = 'green', size = 'md', className = '', disabled, full,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  disabled?: boolean;
  full?: boolean;
}) {
  const [c, d] = TONES[tone];
  const sizes = {
    sm: 'px-3.5 py-2 text-sm rounded-xl',
    md: 'px-5 py-3 text-base rounded-2xl',
    lg: 'px-7 py-4 text-lg rounded-2xl',
    xl: 'px-8 py-5 text-2xl rounded-3xl',
  };
  return (
    <button
      disabled={disabled}
      onClick={() => {
        audio.unlock();
        audio.play('click');
        onClick?.();
      }}
      className={`btn3d font-display font-extrabold tracking-wide inline-flex items-center justify-center gap-2 ${sizes[size]} ${full ? 'w-full' : ''} ${className}`}
      style={{ '--c': c, '--d': d } as CSSProperties}
    >
      {children}
    </button>
  );
}

export function IconButton({ children, onClick, label, className = '', badge }: { children: ReactNode; onClick?: () => void; label: string; className?: string; badge?: boolean }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={() => {
        audio.unlock();
        audio.play('click');
        onClick?.();
      }}
      className={`glass relative grid place-items-center rounded-2xl w-11 h-11 text-white/90 hover:bg-white/15 active:scale-95 transition ${className}`}
    >
      {children}
      {badge && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 ring-2 ring-ink-950 pulse-ring" />}
    </button>
  );
}

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

export function CoinPill({ onClick, className = '' }: { onClick?: () => void; className?: string }) {
  const p = useProfile();
  const coins = useCountUp(p.coins);
  return (
    <button onClick={onClick} className={`glass rounded-full pl-1.5 pr-4 py-1.5 flex items-center gap-2 active:scale-95 transition ${className}`}>
      <Emoji name="coin" size={26} />
      <span className="font-display font-bold text-amber-200 tabular-nums">{coins.toLocaleString('ru-RU')}</span>
    </button>
  );
}

export function TopBar({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),14px)] pb-3">
      <IconButton label="Назад" onClick={onBack}>
        <ChevronLeft size={24} />
      </IconButton>
      <h1 className="font-display font-extrabold text-xl sm:text-2xl flex-1 truncate">{title}</h1>
      {right ?? <CoinPill />}
    </div>
  );
}

export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={`absolute inset-0 flex flex-col ${className}`}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

export function Modal({ open, onClose, children, className = '' }: { open: boolean; onClose?: () => void; children: ReactNode; className?: string }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/55 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={`glass-strong rounded-[28px] w-full max-w-md max-h-[92vh] overflow-y-auto no-scrollbar ${className}`}
            initial={{ scale: 0.85, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Chip({ active, onClick, children, className = '' }: { active: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      onClick={() => {
        audio.play('click');
        onClick();
      }}
      className={`rounded-2xl px-3 py-2.5 flex items-center gap-2 font-semibold text-sm transition border active:scale-95 ${
        active ? 'bg-emerald-400/20 border-emerald-300/70 text-white shadow-[0_0_0_3px_rgba(52,211,153,0.18)]' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => {
        audio.play('click');
        onChange(!on);
      }}
      className={`relative w-14 h-8 rounded-full transition ${on ? 'bg-emerald-500' : 'bg-white/15'}`}
    >
      <motion.span
        className="absolute top-1 w-6 h-6 rounded-full bg-white shadow"
        animate={{ left: on ? 28 : 4 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

export function ProgressBar({ value, max, color = '#4ade80', className = '' }: { value: number; max: number; color?: string; className?: string }) {
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <div className={`h-2.5 rounded-full bg-black/30 overflow-hidden ${className}`}>
      <motion.div className="h-full rounded-full" style={{ background: color }} initial={false} animate={{ width: `${pct * 100}%` }} transition={{ duration: 0.5 }} />
    </div>
  );
}

export function Stars({ count, size = 22, max = 3, animateIn = false }: { count: number; size?: number; max?: number; animateIn?: boolean }) {
  return (
    <div className="flex items-end gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <motion.div
          key={i}
          initial={animateIn ? { scale: 0, rotate: -90 } : false}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: animateIn ? 0.5 + i * 0.3 : 0, type: 'spring', stiffness: 300, damping: 14 }}
          style={{ marginBottom: i === 1 && max === 3 ? size * 0.2 : 0 }}
        >
          <Emoji name="star" size={i === 1 && max === 3 ? size * 1.2 : size} style={{ filter: i < count ? undefined : 'grayscale(1) brightness(0.45)', opacity: i < count ? 1 : 0.6 }} />
        </motion.div>
      ))}
    </div>
  );
}

export const isTouchDevice = () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
