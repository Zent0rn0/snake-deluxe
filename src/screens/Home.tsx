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
    void preload([...FRUITS, 'golden', 'coin', ...Object.values(POWERS).map((p) => p.sprite), ...HATS.map((h) => h.sprite).filter(Boolean)]);
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
      <canvas ref={ref} className="absolute left-1/2 top-1/2 opacity-35 origin-center" />
      <div className="absolute inset-0 bg-gradient-to-b from-ink-950/70 via-ink-950/45 to-ink-950/90" />
    </div>
  );
}

function modeBadge(m: ModeInfo, p: Profile): string {
  switch (m.id) {
    case 'campaign': {
      const stars = Object.values(p.campaign).reduce((a, b) => a + b, 0);
      return `⭐ ${stars}/${LEVELS.length * 3}`;
    }
    case 'daily':
      return p.daily.rewarded ? '✅ Пройдено' : `🎯 Цель ${dailyChallenge().goalScore}`;
    case 'duel':
      return '⌨️ 2 игрока';
    default: {
      const best = p.best[m.id] ?? 0;
      return best ? `🏆 ${best}` : 'Новинка';
    }
  }
}

export function Home({ go, play }: { go: (r: Route) => void; play: (l: Launch) => void }) {
  const p = useProfile();
  const lvl = levelInfo(p.xp);
  const nextLevel = LEVELS.find((l) => !(p.campaign[l.id] > 0));
  const questsReady = p.quests.list.some((q) => !q.claimed && q.progress >= q.target);
  const rewardsBadge = canSpinFree(p) || questsReady;

  return (
    <Screen>
      <DemoBackground theme={p.equipped.theme} />
      <div className="relative flex-1 overflow-y-auto no-scrollbar">
        <div className="max-w-xl mx-auto px-4 pt-[max(env(safe-area-inset-top),14px)] pb-28">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button onClick={() => go('achievements')} className="glass rounded-2xl pl-1.5 pr-3 py-1.5 flex items-center gap-2 min-w-0">
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 grid place-items-center">
                <Emoji name="snake" size={30} />
                <span className="absolute -bottom-1.5 -right-1.5 bg-amber-400 text-ink-950 text-[11px] font-display font-black rounded-full w-6 h-6 grid place-items-center ring-2 ring-ink-950">{lvl.level}</span>
              </div>
              <div className="w-24 text-left">
                <div className="text-[11px] text-white/60 font-bold uppercase tracking-wider">Уровень {lvl.level}</div>
                <ProgressBar value={lvl.into} max={lvl.need} className="mt-1 h-2" />
              </div>
            </button>
            <div className="flex-1" />
            <CoinPill onClick={() => go('shop')} />
            <IconButton label="Настройки" onClick={() => go('settings')}>
              <SettingsIcon size={20} />
            </IconButton>
          </div>

          {/* Logo */}
          <div className="text-center mt-6 sm:mt-10 select-none">
            <motion.div initial={{ scale: 0.4, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 12 }}>
              <Emoji name="snake" size={112} className="mx-auto animate-float drop-shadow-[0_18px_30px_rgba(34,197,94,0.45)]" />
            </motion.div>
            <motion.h1
              initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
              className="font-display font-black text-6xl sm:text-7xl tracking-tight text-gradient-snake leading-none mt-1"
              style={{ filter: 'drop-shadow(0 5px 0 #14532d) drop-shadow(0 14px 24px rgba(0,0,0,.45))' }}
            >
              ЗМЕЙКА
            </motion.h1>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring' }}
              className="inline-block mt-3 rounded-full px-4 py-1 bg-gradient-to-r from-amber-300 to-pink-400 text-ink-950 font-display font-black text-sm tracking-[0.3em] -rotate-2 shadow-lg">
              DELUXE
            </motion.div>
          </div>

          {/* Play */}
          <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="mt-7">
            <Button size="xl" full className="shine" onClick={() => (nextLevel ? play({ mode: 'campaign', levelId: nextLevel.id }) : play({ mode: 'classic' }))}>
              <span className="flex flex-col items-center leading-tight">
                <span className="flex items-center gap-3">▶ ИГРАТЬ</span>
                <span className="text-xs font-body font-bold opacity-85 tracking-normal mt-0.5">
                  {nextLevel ? `Приключение · уровень ${nextLevel.id}: ${nextLevel.name}` : 'Миксер · быстрая игра'}
                </span>
              </span>
            </Button>
          </motion.div>

          {/* Modes */}
          <div className="grid grid-cols-2 gap-3 mt-6">
            {MODES.map((m, i) => (
              <motion.button
                key={m.id}
                initial={{ y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.25 + i * 0.05 }}
                whileTap={{ scale: 0.96 }}
                whileHover={{ y: -3 }}
                onClick={() => go(m.id)}
                className={`glass relative text-left rounded-3xl p-3.5 overflow-hidden bg-gradient-to-br ${m.gradient}`}
              >
                <Emoji name={m.sprite} size={44} className="mb-1.5" />
                <div className="font-display font-extrabold text-[15px] leading-tight">{m.name}</div>
                <div className="text-[12px] text-white/65 leading-snug mt-0.5 min-h-[32px]">{m.tagline}</div>
                <div className="mt-2 inline-block rounded-full bg-black/25 px-2.5 py-0.5 text-[11px] font-bold text-white/85">{modeBadge(m, p)}</div>
                {m.id === 'daily' && !p.daily.rewarded && <span className="absolute top-3 right-3 w-3 h-3 rounded-full bg-rose-500 pulse-ring" />}
              </motion.button>
            ))}
          </div>

          {/* Quests teaser */}
          <button onClick={() => go('rewards')} className="glass w-full mt-4 rounded-3xl p-3.5 text-left flex items-center gap-3">
            <Emoji name="bullseye" size={40} />
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold text-sm">Задания дня</div>
              <div className="flex gap-1.5 mt-1.5">
                {p.quests.list.map((q) => (
                  <ProgressBar key={q.id} value={q.progress} max={q.target} className="flex-1 h-2" color={q.claimed ? '#64748b' : '#facc15'} />
                ))}
              </div>
            </div>
            {questsReady && <span className="rounded-full bg-amber-400 text-ink-950 text-xs font-black px-2.5 py-1">Награда!</span>}
          </button>
        </div>
      </div>

      {/* Dock */}
      <div className="absolute bottom-0 inset-x-0 pb-[max(env(safe-area-inset-bottom),10px)] px-4">
        <div className="max-w-xl mx-auto glass-strong rounded-3xl p-2 grid grid-cols-4 gap-1">
          {([
            ['shop', 'bags', 'Магазин', false],
            ['rewards', 'gift', 'Награды', rewardsBadge],
            ['achievements', 'trophy', 'Трофеи', false],
            ['stats', 'medal', 'Рекорды', false],
          ] as const).map(([route, sprite, label, badge]) => (
            <button key={route} onClick={() => go(route)} className="relative rounded-2xl py-1.5 flex flex-col items-center hover:bg-white/10 active:scale-95 transition">
              <Emoji name={sprite} size={30} className={badge ? 'animate-wiggle' : ''} />
              <span className="text-[11px] font-bold text-white/80 mt-0.5">{label}</span>
              {badge && <span className="absolute top-1 right-[22%] w-3 h-3 rounded-full bg-rose-500 ring-2 ring-ink-900" />}
            </button>
          ))}
        </div>
      </div>
    </Screen>
  );
}
