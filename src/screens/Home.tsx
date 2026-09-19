import { motion } from 'framer-motion';
import { Settings as SettingsIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { preload } from '../game/assets';
import { FRUITS, HATS, POWERS } from '../game/content';
import { Engine } from '../game/engine';
import { demoConfig, MODES, dailyChallenge, type Launch, type ModeInfo } from '../game/launch';
import { LEVELS } from '../game/levels';
import { Renderer } from '../game/renderer';
import { canSpinFree, levelInfo, useProfile, type Profile } from '../store/profile';
import { useViewport } from '../ui/hooks';
import { Button, CoinPill, Emoji, IconButton, ProgressBar, Screen } from '../ui/kit';
import type { Route } from '../App';

function DemoBackground({ theme }: { theme: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const box = wrap.current!;
    const cell = window.innerWidth < 640 ? 30 : 40;
    const cols = Math.max(14, Math.ceil(box.clientWidth / cell));
    const rows = Math.max(12, Math.ceil(box.clientHeight / cell));
    const engine = new Engine(demoConfig(cols, rows));
    const renderer = new Renderer(canvas, engine, theme);
    renderer.reducedFx = true;
    void preload([
      ...FRUITS,
      'golden',
      'coin',
      ...Object.values(POWERS).map((p) => p.sprite),
      ...HATS.map((h) => h.sprite).filter(Boolean),
    ]);
    const fit = () => {
      renderer.resize(box.clientWidth * 1.08, box.clientHeight * 1.08);
      const s = Math.max(box.clientWidth / renderer.width, box.clientHeight / renderer.height);
      canvas.style.transform = `translate(-50%, -50%) scale(${s * 1.02})`;
    };
    fit();
    window.addEventListener('resize', fit);
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      engine.update(dt);
      renderer.onEvents(engine.drainEvents());
      renderer.render(dt, now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
    };
  }, [theme]);
  return (
    <div ref={wrap} className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Quiet enough to read as texture, not as a second game competing for attention. */}
      <canvas ref={ref} className="absolute left-1/2 top-1/2 opacity-20 origin-center blur-[2px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-ink-950/75 via-ink-950/55 to-ink-950/95" />
    </div>
  );
}

function modeBadge(m: ModeInfo, p: Profile): string {
  switch (m.id) {
    case 'campaign': {
      const stars = Object.values(p.campaign).reduce((a, b) => a + b, 0);
      return `★ ${stars}/${LEVELS.length * 3}`;
    }
    case 'daily':
      return p.daily.rewarded ? 'Пройдено' : `Цель ${dailyChallenge().goalScore}`;
    case 'duel':
      return '2 игрока';
    default: {
      const best = p.best[m.id] ?? 0;
      return best ? `Рекорд ${best}` : 'Новинка';
    }
  }
}

function ModeCard({
  mode,
  badge,
  alert,
  onClick,
  index,
}: {
  mode: ModeInfo;
  badge: string;
  alert: boolean;
  onClick: () => void;
  index: number;
}) {
  return (
    <motion.button
      initial={{ y: 18, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2 + index * 0.04, duration: 0.3 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="glass relative text-left rounded-panel p-3 pt-3.5 overflow-hidden"
    >
      {/* Identity colour as a top rule and a faint wash — one hue per mode. */}
      <span className="absolute top-0 inset-x-0 h-[3px]" style={{ background: mode.accent }} />
      <span
        className="absolute inset-0 pointer-events-none opacity-[0.10]"
        style={{ background: `radial-gradient(120% 90% at 10% 0%, ${mode.accent}, transparent 65%)` }}
      />
      <Emoji name={mode.sprite} size={34} className="mb-1 relative" />
      <div className="font-display font-extrabold text-[15px] leading-tight relative">{mode.name}</div>
      <div className="text-[11.5px] text-fg-soft leading-snug mt-0.5 min-h-[30px] relative">{mode.tagline}</div>
      <div className="mt-1.5 inline-block rounded-full bg-black/30 px-2.5 py-0.5 text-[10.5px] font-bold text-fg-soft relative">
        {badge}
      </div>
      {alert && <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-danger ring-2 ring-ink-800" />}
    </motion.button>
  );
}

export function Home({ go, play }: { go: (r: Route) => void; play: (l: Launch) => void }) {
  const p = useProfile();
  const { device, short } = useViewport();
  const lvl = levelInfo(p.xp);
  const nextLevel = LEVELS.find((l) => !(p.campaign[l.id] > 0));
  const questsReady = p.quests.list.some((q) => !q.claimed && q.progress >= q.target);
  const rewardsBadge = canSpinFree(p) || questsReady;

  return (
    <Screen>
      <DemoBackground theme={p.equipped.theme} />
      <div className="relative flex-1 overflow-y-auto no-scrollbar">
        <div className="safe-x max-w-xl md:max-w-3xl mx-auto px-4 pt-[max(var(--sat),14px)] pb-28">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button onClick={() => go('achievements')} className="glass rounded-card pl-1.5 pr-3 py-1.5 flex items-center gap-2 min-w-0">
              <div className="relative w-10 h-10 rounded-sm bg-gradient-to-br from-accent to-accent-deep grid place-items-center">
                <Emoji name="snake" size={28} />
                <span className="absolute -bottom-1.5 -right-1.5 bg-reward text-ink-950 text-[11px] font-display font-black rounded-full w-6 h-6 grid place-items-center ring-2 ring-ink-900">
                  {lvl.level}
                </span>
              </div>
              <div className="w-24 text-left">
                <div className="text-[11px] text-fg-mute font-bold uppercase tracking-wider">Уровень {lvl.level}</div>
                <ProgressBar value={lvl.into} max={lvl.need} className="mt-1 h-2" />
              </div>
            </button>
            <div className="flex-1" />
            <CoinPill onClick={() => go('shop')} />
            <IconButton label="Настройки" onClick={() => go('settings')}>
              <SettingsIcon size={20} />
            </IconButton>
          </div>

          {/* Wordmark. One gradient, one depth shadow, a die-cut edge — no bloom. */}
          <div className={`text-center select-none ${short ? 'mt-2' : 'mt-4 sm:mt-8'}`}>
            <motion.div
              initial={{ scale: 0.5, rotate: -14, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 14 }}
            >
              <Emoji
                name="snake"
                size={short ? 56 : device === 'phone' ? 74 : 104}
                className="mx-auto animate-float drop-shadow-[0_14px_24px_rgba(0,0,0,0.55)]"
              />
            </motion.div>
            <motion.h1
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.08 }}
              className="font-display font-black tracking-tight text-gradient-snake text-depth leading-none mt-1"
              style={{ fontSize: short ? '2.1rem' : 'clamp(2.4rem, 11.5vw, 4.25rem)' }}
            >
              ЗМЕЙКА
            </motion.h1>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.24, type: 'spring', stiffness: 300, damping: 18 }}
              className="inline-block mt-2 rounded-full px-3.5 py-0.5 bg-reward text-ink-950 font-display font-black text-[11px] tracking-[0.28em] -rotate-2 shadow-e2"
            >
              DELUXE
            </motion.div>
          </div>

          {/* Play */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className={short ? 'mt-3.5' : 'mt-5'}
          >
            <Button
              size="xl"
              full
              onClick={() => (nextLevel ? play({ mode: 'campaign', levelId: nextLevel.id }) : play({ mode: 'classic' }))}
            >
              <span className="flex flex-col items-center leading-tight">
                <span className="flex items-center gap-3">▶ ИГРАТЬ</span>
                <span className="text-xs font-body font-bold opacity-85 tracking-normal mt-0.5">
                  {nextLevel ? `Приключение · уровень ${nextLevel.id}: ${nextLevel.name}` : 'Миксер · быстрая игра'}
                </span>
              </span>
            </Button>
          </motion.div>

          {/* Modes */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 mt-4">
            {MODES.map((m, i) => (
              <ModeCard
                key={m.id}
                mode={m}
                index={i}
                badge={modeBadge(m, p)}
                alert={m.id === 'daily' && !p.daily.rewarded}
                onClick={() => go(m.id)}
              />
            ))}
          </div>

          {/* Quests teaser */}
          <button onClick={() => go('rewards')} className="glass w-full mt-3 rounded-panel p-3 text-left flex items-center gap-3">
            <Emoji name="bullseye" size={34} />
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold text-sm">Задания дня</div>
              <div className="flex gap-1.5 mt-1.5">
                {p.quests.list.map((q) => (
                  <ProgressBar
                    key={q.id}
                    value={q.progress}
                    max={q.target}
                    className="flex-1 h-2"
                    color={q.claimed ? '#6f6d85' : '#e3b04b'}
                  />
                ))}
              </div>
            </div>
            {questsReady && <span className="rounded-full bg-reward text-ink-950 text-xs font-black px-2.5 py-1">Награда!</span>}
          </button>
        </div>
      </div>

      {/* Dock */}
      <div className="absolute bottom-0 inset-x-0 safe-x pb-[max(var(--sab),10px)] px-4">
        <div className="max-w-xl md:max-w-3xl mx-auto glass-strong rounded-panel p-2 grid grid-cols-4 gap-1">
          {(
            [
              ['shop', 'bags', 'Магазин', false],
              ['rewards', 'gift', 'Награды', rewardsBadge],
              ['achievements', 'trophy', 'Трофеи', false],
              ['stats', 'medal', 'Рекорды', false],
            ] as const
          ).map(([route, sprite, label, badge]) => (
            <button
              key={route}
              onClick={() => go(route)}
              className="relative rounded-card py-1.5 flex flex-col items-center hover:bg-white/[0.07] active:scale-95 transition"
            >
              <Emoji name={sprite} size={28} className={badge ? 'animate-wiggle' : ''} />
              <span className="text-[11px] font-bold text-fg-soft mt-0.5">{label}</span>
              {badge && <span className="absolute top-1 right-[22%] w-2.5 h-2.5 rounded-full bg-danger ring-2 ring-ink-700" />}
            </button>
          ))}
        </div>
      </div>
    </Screen>
  );
}
