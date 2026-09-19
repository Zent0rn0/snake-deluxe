import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { type CSSProperties, type ReactNode } from 'react';
import { audio } from '../audio/audio';
import { TONE, type ToneName, spring } from '../design/tokens';
import { emojiUrl } from '../game/assets';
import { useProfile } from '../store/profile';
import { useCountUp } from './hooks';

export function Emoji({
  name,
  size = 32,
  className = '',
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <img
      src={emojiUrl(name)}
      width={size}
      height={size}
      alt=""
      draggable={false}
      className={`inline-block shrink-0 drop-shadow-[0_3px_5px_rgba(0,0,0,0.45)] ${className}`}
      style={{ width: size, height: size, ...style }}
    />
  );
}

export type Tone = ToneName;

/** The chunky primary action. `tone` carries meaning, never decoration. */
export function Button({
  children,
  onClick,
  tone = 'accent',
  size = 'md',
  className = '',
  disabled,
  full,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  disabled?: boolean;
  full?: boolean;
}) {
  const { base, deep } = TONE[tone];
  const sizes = {
    sm: 'px-3.5 py-2 text-sm rounded-sm',
    md: 'px-5 py-3 text-base rounded-card',
    lg: 'px-7 py-4 text-lg rounded-card',
    xl: 'px-8 py-5 text-2xl rounded-panel',
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
      style={{ '--c': base, '--d': deep } as CSSProperties}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children,
  onClick,
  label,
  className = '',
  badge,
}: {
  children: ReactNode;
  onClick?: () => void;
  label: string;
  className?: string;
  badge?: boolean;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={() => {
        audio.unlock();
        audio.play('click');
        onClick?.();
      }}
      className={`glass relative grid place-items-center rounded-card w-11 h-11 text-fg/90 active:scale-95 transition ${className}`}
    >
      {children}
      {badge && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-danger ring-2 ring-ink-900" />}
    </button>
  );
}

// ─── Surfaces ───────────────────────────────────────────────────────────────

/**
 * The standard panel. `raised` is for modals and anything that floats above
 * another surface; `overlay` is the only translucent variant and belongs on
 * in-game chrome where the board must show through.
 */
export function Card({
  children,
  variant = 'flat',
  className = '',
  onClick,
}: {
  children: ReactNode;
  variant?: 'flat' | 'raised' | 'overlay';
  className?: string;
  onClick?: () => void;
}) {
  const skin = variant === 'raised' ? 'glass-strong' : variant === 'overlay' ? 'overlay-glass' : 'glass';
  const cls = `${skin} rounded-panel ${className}`;
  if (!onClick) return <div className={cls}>{children}</div>;
  return (
    <button
      onClick={() => {
        audio.play('click');
        onClick();
      }}
      className={`${cls} text-left active:scale-[0.98] transition`}
    >
      {children}
    </button>
  );
}

/** A titled block. Replaces nine hand-rolled copies of the same markup. */
export function Section({
  title,
  right,
  children,
  className = '',
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`glass rounded-panel p-4 ${className}`}>
      <div className="flex items-center mb-3">
        <h2 className="font-display font-bold text-sm uppercase tracking-wider text-fg-soft flex-1">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

/** Sprite over a number over a caption — the stat grid unit. */
export function StatTile({
  sprite,
  label,
  value,
  spriteSize = 26,
  className = '',
}: {
  sprite: string;
  label: string;
  value: ReactNode;
  spriteSize?: number;
  className?: string;
}) {
  return (
    <div className={`rounded-card bg-white/[0.04] border border-line-subtle py-2.5 px-1 text-center ${className}`}>
      <Emoji name={sprite} size={spriteSize} className="mx-auto" />
      <div className="font-display font-bold tabular-nums mt-1 leading-none">{value}</div>
      <div className="text-[10px] text-fg-mute uppercase font-bold leading-tight mt-1">{label}</div>
    </div>
  );
}

const BADGE_TONE: Record<ToneName, string> = {
  accent: 'bg-accent/15 border-accent/40 text-accent-soft',
  reward: 'bg-reward/15 border-reward/40 text-reward-soft',
  danger: 'bg-danger/15 border-danger/40 text-danger-soft',
  info: 'bg-info/15 border-info/40 text-info-soft',
  special: 'bg-special/15 border-special/40 text-special-soft',
  neutral: 'bg-white/[0.06] border-line text-fg-soft',
};

export function Badge({ children, tone = 'neutral', className = '' }: { children: ReactNode; tone?: ToneName; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${BADGE_TONE[tone]} ${className}`}>
      {children}
    </span>
  );
}

/** Icon + label + optional hint + a control on the right. */
export function ListRow({
  sprite,
  icon,
  label,
  hint,
  children,
  className = '',
}: {
  sprite?: string;
  icon?: ReactNode;
  label: string;
  hint?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 py-2.5 ${className}`}>
      {sprite ? <Emoji name={sprite} size={28} /> : <span className="text-fg-soft w-7 grid place-items-center">{icon}</span>}
      <div className="flex-1 min-w-0">
        <div className="font-semibold">{label}</div>
        {hint && <div className="text-xs text-fg-mute">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

/** A row of mutually exclusive options. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: T;
  options: { id: T; label: ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      className={`grid gap-1 p-1 rounded-card bg-black/25 border border-line-subtle ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o.id}
          aria-pressed={value === o.id}
          onClick={() => {
            audio.play('click');
            onChange(o.id);
          }}
          className={`rounded-sm py-2 px-1 text-sm font-bold transition ${
            value === o.id ? 'bg-ink-600 text-fg shadow-e1' : 'text-fg-mute hover:text-fg-soft'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Chrome ─────────────────────────────────────────────────────────────────

export function CoinPill({ onClick, className = '' }: { onClick?: () => void; className?: string }) {
  const p = useProfile();
  const coins = useCountUp(p.coins);
  return (
    <button
      onClick={onClick}
      className={`glass rounded-full pl-1.5 pr-4 py-1.5 flex items-center gap-2 active:scale-95 transition ${className}`}
    >
      <Emoji name="coin" size={24} />
      <span className="font-display font-bold text-reward-soft tabular-nums">{coins.toLocaleString('ru-RU')}</span>
    </button>
  );
}

export function TopBar({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <div className="safe-x flex items-center gap-3 px-4 pt-[max(var(--sat),14px)] pb-3">
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Modal({
  open,
  onClose,
  children,
  className = '',
}: {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={`glass-strong rounded-sheet w-full max-w-md max-h-[min(92dvh,44rem)] overflow-y-auto no-scrollbar ${className}`}
            initial={{ scale: 0.9, y: 22, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.94, y: 14, opacity: 0 }}
            transition={spring.snappy}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Chip({
  active,
  onClick,
  children,
  className = '',
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      aria-pressed={active}
      onClick={() => {
        audio.play('click');
        onClick();
      }}
      className={`rounded-card px-3 py-2.5 flex items-center gap-2 font-semibold text-sm transition border active:scale-95 ${
        active ? 'bg-accent/18 border-accent/60 text-fg' : 'bg-white/[0.04] border-line-subtle text-fg-soft hover:bg-white/[0.08]'
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
      className={`relative w-14 h-8 rounded-full transition border ${on ? 'bg-accent border-accent-soft/40' : 'bg-ink-600 border-line'}`}
    >
      <motion.span
        className="absolute top-1 w-6 h-6 rounded-full bg-white shadow-e1"
        animate={{ left: on ? 28 : 3 }}
        transition={spring.snappy}
      />
    </button>
  );
}

export function ProgressBar({ value, max, color, className = '' }: { value: number; max: number; color?: string; className?: string }) {
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <div className={`h-2.5 rounded-full bg-black/35 overflow-hidden ${className}`}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color ?? TONE.accent.base }}
        initial={false}
        animate={{ width: `${pct * 100}%` }}
        transition={{ duration: 0.45 }}
      />
    </div>
  );
}

export function Stars({
  count,
  size = 22,
  max = 3,
  animateIn = false,
}: {
  count: number;
  size?: number;
  max?: number;
  animateIn?: boolean;
}) {
  return (
    <div className="flex items-end gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <motion.div
          key={i}
          initial={animateIn ? { scale: 0, rotate: -90 } : false}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: animateIn ? 0.45 + i * 0.28 : 0, ...spring.pop }}
          style={{ marginBottom: i === 1 && max === 3 ? size * 0.2 : 0 }}
        >
          <Emoji
            name="star"
            size={i === 1 && max === 3 ? size * 1.2 : size}
            style={{
              filter: i < count ? undefined : 'grayscale(1) brightness(0.4)',
              opacity: i < count ? 1 : 0.55,
            }}
          />
        </motion.div>
      ))}
    </div>
  );
}
