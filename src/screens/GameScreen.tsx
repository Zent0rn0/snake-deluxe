import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'framer-motion';
import { Home, Pause, Play, RotateCcw, Volume2, VolumeX, Music, ChevronRight, Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { audio, vibrate } from '../audio/audio';
import { preload } from '../game/assets';
import { FRUITS, POWERS, skinById, mutatorById, HATS, THEMES } from '../game/content';
import { Engine } from '../game/engine';
import { buildConfig, dailyChallenge, type Launch } from '../game/launch';
import { LEVELS, levelPar } from '../game/levels';
import { Renderer } from '../game/renderer';
import type { Dir, GameEvent, PowerId, RunResult } from '../game/types';
import { applyRun, getProfile, setProfile, useProfile, type RunReward, questDef } from '../store/profile';
import { Button, Emoji, IconButton, Modal, Stars, Toggle, isTouchDevice, useCountUp } from '../ui/kit';
import { toastAchievements } from '../ui/toasts';

interface Hud {
  phase: string;
  countdown: number;
  score: number;
  combo: number;
  comboPct: number;
  mult: number;
  length: number;
  timeLeft: number;
  time: number;
  goal: number;
  fruits: number;
  rivalFruits: number;
  powers: { id: PowerId; pct: number }[];
  shield: boolean;
  reversed: boolean;
  rank: number;
  board: { name: string; score: number; color: string; alive: boolean; me: boolean }[];
  duelWins: [number, number];
  round: number;
  roundWinner: number | null;
  alive: boolean;
}

function snapshot(e: Engine): Hud {
  const p = e.player ?? e.snakes[0];
  const comboWindow = Math.max(2200, p.stepMs * 24);
  return {
    phase: e.phase,
    countdown: e.phase === 'countdown' ? Math.ceil(e.countdownMs / 1000) : 0,
    score: p.score,
    combo: p.comboTimer > 0 ? p.combo : 0,
    comboPct: p.comboTimer > 0 ? p.comboTimer / comboWindow : 0,
    mult: 1 + Math.floor((Math.max(1, p.combo) - 1) / 3),
    length: p.body.length,
    timeLeft: e.timeLeft,
    time: e.time,
    goal: e.goal,
    fruits: p.fruits,
    rivalFruits: e.rivalId >= 0 ? e.snakes[e.rivalId].fruits : 0,
    powers: (Object.keys(p.effects) as PowerId[]).map((id) => ({ id, pct: (p.effects[id] ?? 0) / POWERS[id].durationMs })),
    shield: p.shield,
    reversed: p.reversed > 0,
    rank: e.cfg.mode === 'arena' ? e.arenaRank() : 0,
    board: e.cfg.mode === 'arena'
      ? [...e.snakes].sort((a, b) => b.score - a.score).map((s) => ({ name: s.name, score: s.score, color: skinById(s.skin).preview[0], alive: s.alive, me: s.controller === 'p1' }))
      : [],
    duelWins: [...e.duelWins] as [number, number],
    round: e.round,
    roundWinner: e.lastRoundWinner,
    alive: p.alive,
  };
}

const KEY_DIR: Record<string, [Dir, 'p1' | 'p2' | 'any']> = {
  ArrowUp: [0, 'p2'], ArrowRight: [1, 'p2'], ArrowDown: [2, 'p2'], ArrowLeft: [3, 'p2'],
  KeyW: [0, 'p1'], KeyD: [1, 'p1'], KeyS: [2, 'p1'], KeyA: [3, 'p1'],
};

function playEventSounds(events: GameEvent[], e: Engine, vibration: boolean) {
  for (const ev of events) {
    const snake = 'snake' in ev ? e.snakes[ev.snake] : undefined;
    const mine = !snake || snake.controller !== 'bot';
    const vol = mine ? 1 : 0.3;
    switch (ev.type) {
      case 'eat':
        if (ev.kind === 'fruit') audio.play('eat', { rate: 1 + Math.min(ev.combo, 14) * 0.045, volume: vol });
        else if (ev.kind === 'orb') audio.play('orb', { rate: 1 + Math.min(ev.combo, 14) * 0.03, volume: vol * 0.7 });
        else if (ev.kind === 'golden') audio.play('golden', { volume: vol });
        else if (ev.kind === 'coin') audio.play('coin', { volume: vol });
        else if (ev.kind === 'power') audio.play('power', { volume: vol });
        else if (ev.kind === 'poison') audio.play('poison', { volume: vol });
        else if (ev.kind === 'key') audio.play('unlock');
        else if (ev.kind === 'clock') audio.play('clock');
        if (mine && vibration) vibrate(ev.kind === 'golden' ? 40 : 12);
        break;
      case 'die':
        if (mine) {
          audio.play('die');
          if (vibration) vibrate([60, 40, 120]);
        } else audio.play('kill', { volume: ev.by !== undefined && e.snakes[ev.by]?.controller === 'p1' ? 1 : 0.35 });
        break;
      case 'shield': audio.play('shield'); if (vibration) vibrate(50); break;
      case 'portal': audio.play('portal', { volume: vol }); break;
      case 'rock': audio.play('rock', { volume: 0.7 }); break;
      case 'powerEnd': if (mine) audio.play('powerEnd'); break;
      case 'timeUp': audio.play('go'); break;
      case 'round': audio.play('go'); break;
    }
  }
}

export function GameScreen({ launch, onExit, onRelaunch }: { launch: Launch; onExit: () => void; onRelaunch: (l: Launch) => void }) {
  const profile = useProfile();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<{ run: RunResult; reward: RunReward } | null>(null);
  const settingsRef = useRef(profile.settings);
  settingsRef.current = profile.settings;
  const [showHint] = useState(() => !getProfile().tutorialSeen);

  const mode = launch.mode;
  const level = launch.mode === 'campaign' ? LEVELS.find((l) => l.id === launch.levelId) : undefined;
  const touch = isTouchDevice();
  const showDpad = profile.settings.dpad === 'on' || (profile.settings.dpad === 'auto' && touch && mode !== 'duel');
  const canBoost = mode === 'arena' || mode === 'classic' || mode === 'daily' || mode === 'blitz';

  // ── Engine + render loop ──
  useEffect(() => {
    const canvas = canvasRef.current!;
    const container = containerRef.current!;
    const p = getProfile();
    const portrait = window.innerHeight > window.innerWidth * 1.05;
    const engine = new Engine(buildConfig(launch, p, portrait));
    engineRef.current = engine;
    if (import.meta.env.DEV) (window as unknown as { __engine: Engine }).__engine = engine;
    const renderer = new Renderer(canvas, engine, p.equipped.theme);
    renderer.reducedFx = p.settings.reducedFx;

    void preload([
      ...FRUITS, 'golden', 'coin', 'key', 'locked', 'mushroom', 'stopwatch',
      ...Object.values(POWERS).map((x) => x.sprite), ...HATS.map((h) => h.sprite).filter(Boolean),
      ...THEMES.map((t) => t.rock),
    ]);

    const fit = () => renderer.resize(container.clientWidth, container.clientHeight);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(container);

    audio.setTrack('game', mode === 'blitz' ? 1.15 : 1);
    audio.startMusic();
    audio.play('beep');

    let raf = 0;
    let last = performance.now();
    let hudAcc = 1000;
    let lastCd = engine.phase === 'countdown' ? Math.ceil(engine.countdownMs / 1000) : 0;
    let lastPhase = engine.phase;
    let overHandled = false;

    const frame = (now: number) => {
      const dt = Math.min(now - last, 100);
      last = now;
      engine.update(dt);

      const cd = engine.phase === 'countdown' ? Math.ceil(engine.countdownMs / 1000) : 0;
      if (cd !== lastCd) {
        if (cd > 0) audio.play('beep');
        else if (engine.phase === 'playing') audio.play('go');
        lastCd = cd;
      }

      const events = engine.drainEvents();
      if (events.length) {
        renderer.onEvents(events);
        playEventSounds(events, engine, settingsRef.current.vibration);
      }
      renderer.render(dt, now);

      hudAcc += dt;
      if (hudAcc > 70 || engine.phase !== lastPhase) {
        hudAcc = 0;
        lastPhase = engine.phase;
        setHud(snapshot(engine));
      }

      if (engine.phase === 'over' && !overHandled && engine.result) {
        overHandled = true;
        const run = engine.result;
        window.setTimeout(() => {
          const reward = applyRun(run);
          setResult({ run, reward });
          const good = run.win || reward.newBest;
          if (mode === 'duel' ? run.duelWinner !== null : good) {
            audio.win();
            if (!getProfile().settings.reducedFx) {
              confetti({ particleCount: 140, spread: 80, origin: { y: 0.35 }, zIndex: 70, colors: ['#4ade80', '#facc15', '#f472b6', '#60a5fa'] });
            }
          } else {
            audio.lose();
          }
          toastAchievements(reward.achievements);
        }, 350);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onVisibility = () => {
      if (document.hidden && (engine.phase === 'playing' || engine.phase === 'countdown')) {
        engine.pause();
        setPaused(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      audio.setTrack('menu');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePause = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    if (e.phase === 'paused') {
      e.resume();
      setPaused(false);
    } else if (e.phase === 'playing' || e.phase === 'countdown') {
      e.pause();
      setPaused(true);
      audio.play('whoosh');
    }
  }, []);

  const replay = useCallback(() => onRelaunch(launch), [launch, onRelaunch]);

  // ── Keyboard ──
  useEffect(() => {
    const down = (ev: KeyboardEvent) => {
      const e = engineRef.current;
      if (!e) return;
      audio.unlock();
      if (ev.code === 'Escape' || ev.code === 'KeyP') {
        ev.preventDefault();
        if (e.phase !== 'over' && e.phase !== 'dying') togglePause();
        return;
      }
      if (e.phase === 'over') {
        if (ev.code === 'Enter' || ev.code === 'KeyR' || ev.code === 'Space') {
          ev.preventDefault();
          if (result) replay();
        }
        return;
      }
      if (ev.code === 'Space' || ev.code === 'ShiftLeft' || ev.code === 'ShiftRight') {
        ev.preventDefault();
        if (mode !== 'duel') e.setBoost('p1', true);
        return;
      }
      const m = KEY_DIR[ev.code];
      if (!m) return;
      ev.preventDefault();
      const [dir, who] = m;
      const controller = mode === 'duel' ? (who === 'p2' ? 'p2' : 'p1') : 'p1';
      e.input(controller, dir);
      if (settingsRef.current.turnSound) audio.play('turn');
    };
    const up = (ev: KeyboardEvent) => {
      if (ev.code === 'Space' || ev.code === 'ShiftLeft' || ev.code === 'ShiftRight') engineRef.current?.setBoost('p1', false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [mode, togglePause, replay, result]);

  // ── Swipes ──
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  const onPointerDown = (ev: React.PointerEvent) => {
    audio.unlock();
    if (ev.pointerType === 'mouse') return;
    swipe.current = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
  };
  const onPointerMove = (ev: React.PointerEvent) => {
    const s = swipe.current;
    if (!s || s.id !== ev.pointerId) return;
    const dx = ev.clientX - s.x;
    const dy = ev.clientY - s.y;
    if (Math.hypot(dx, dy) < 22) return;
    const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
    engineRef.current?.input('p1', dir);
    swipe.current = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
  };
  const onPointerUp = () => {
    swipe.current = null;
  };

  const press = (dir: Dir) => {
    audio.unlock();
    engineRef.current?.input('p1', dir);
    if (settingsRef.current.vibration) vibrate(6);
  };

  const exitToMenu = () => {
    setPaused(false);
    onExit();
  };

  const nextLevel = level ? LEVELS.find((l) => l.id === level.id + 1) : undefined;

  return (
    <div className="absolute inset-0 flex flex-col app-bg">
      {/* HUD */}
      <div className="px-3 pt-[max(env(safe-area-inset-top),10px)] pb-2">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <IconButton label="Пауза" onClick={togglePause}>
            <Pause size={22} />
          </IconButton>
          <ScoreBlock hud={hud} />
          <div className="flex-1" />
          <ModeInfo hud={hud} mode={mode} levelGoal={level?.goal} hasRival={!!level?.rival} />
        </div>
        <div className="max-w-3xl mx-auto mt-2 flex items-center gap-2 min-h-[34px] flex-wrap">
          <AnimatePresence>
            {hud?.powers.map((pw) => (
              <motion.div key={pw.id} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="relative w-[34px] h-[34px]">
                <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
                  <circle cx="18" cy="18" r="16" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="16" fill="none" stroke={POWERS[pw.id].color} strokeWidth="3" strokeDasharray={`${pw.pct * 100.5} 100.5`} strokeLinecap="round" />
                </svg>
                <Emoji name={POWERS[pw.id].sprite} size={22} className="absolute inset-0 m-auto" />
              </motion.div>
            ))}
            {hud?.shield && (
              <motion.div key="shield" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="glass rounded-full w-[34px] h-[34px] grid place-items-center">
                <Emoji name="shield" size={22} />
              </motion.div>
            )}
            {hud?.reversed && (
              <motion.div key="rev" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="rounded-full px-3 h-[34px] flex items-center gap-1.5 bg-lime-500/25 border border-lime-300/40 text-lime-200 text-xs font-bold">
                <Emoji name="mushroom" size={20} className="animate-wiggle" /> Управление наоборот!
              </motion.div>
            )}
          </AnimatePresence>
          {hud && hud.combo >= 2 && (
            <div className="ml-auto flex items-center gap-2">
              <span className="font-display font-extrabold text-sm text-pink-300">×{hud.mult}</span>
              <div className="w-20 h-2 rounded-full bg-black/30 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-pink-400 to-amber-300" style={{ width: `${hud.comboPct * 100}%` }} />
              </div>
              <span className="text-xs text-white/60 font-semibold">комбо {hud.combo}</span>
            </div>
          )}
        </div>
      </div>

      {/* Board */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 mx-2 grid place-items-center game-surface"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <canvas ref={canvasRef} className="block drop-shadow-[0_20px_40px_rgba(0,0,0,0.45)]" />

        {mode === 'arena' && hud && (
          <div className="absolute top-1 right-1 glass rounded-xl p-2 text-[11px] w-32 pointer-events-none hidden sm:block">
            {hud.board.slice(0, 6).map((b, i) => (
              <div key={i} className={`flex items-center gap-1.5 py-0.5 ${b.me ? 'font-bold text-white' : 'text-white/70'} ${b.alive ? '' : 'opacity-40'}`}>
                <span className="w-3 text-white/50">{i + 1}</span>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: b.color }} />
                <span className="flex-1 truncate">{b.name}</span>
                <span className="tabular-nums">{b.score}</span>
              </div>
            ))}
          </div>
        )}

        <AnimatePresence>
          {hud && hud.phase === 'countdown' && !paused && (
            <motion.div key={`cd-${hud.countdown}-${hud.round}`} className="absolute inset-0 grid place-items-center pointer-events-none"
              initial={{ scale: 2.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}>
              <div className="text-center">
                {mode === 'duel' && hud.round > 1 && (
                  <div className="font-display text-xl font-bold mb-2 text-white/90 [text-shadow:0_3px_12px_rgba(0,0,0,.6)]">Раунд {hud.round}</div>
                )}
                <div className="font-display font-black text-[96px] leading-none text-white [text-shadow:0_6px_0_rgba(0,0,0,.35),0_0_40px_rgba(74,222,128,.6)]">
                  {hud.countdown}
                </div>
                {level && hud.round === 1 && hud.time === 0 ? (
                  <div className="glass-strong rounded-2xl px-4 py-3 mt-6 text-sm font-semibold max-w-xs mx-auto flex items-center gap-3 text-left">
                    <Emoji name={level.sprite} size={36} />
                    <span>{level.tip}</span>
                  </div>
                ) : showHint && hud.time === 0 ? (
                  <div className="glass-strong rounded-2xl px-4 py-3 mt-6 text-sm font-semibold max-w-xs mx-auto">
                    {touch ? 'Проводи пальцем по экрану, чтобы поворачивать' : 'Стрелки или WASD — поворот, Пробел — ускорение, P — пауза'}
                  </div>
                ) : null}
              </div>
            </motion.div>
          )}
          {hud && hud.phase === 'roundOver' && (
            <motion.div key="round" className="absolute inset-0 grid place-items-center pointer-events-none" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="glass-strong rounded-3xl px-8 py-5 text-center">
                <div className="font-display font-black text-3xl">{hud.roundWinner === null ? 'Ничья!' : `Раунд за игроком ${hud.roundWinner + 1}`}</div>
                <div className="font-display text-5xl mt-2 font-black tabular-nums">{hud.duelWins[0]} : {hud.duelWins[1]}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Touch controls */}
      {showDpad ? (
        <div className="pb-[max(env(safe-area-inset-bottom),12px)] pt-2 flex items-center justify-center gap-8">
          <DPad onPress={press} />
          {canBoost && <BoostButton onChange={(on) => engineRef.current?.setBoost('p1', on)} />}
        </div>
      ) : (
        <div className="pb-[max(env(safe-area-inset-bottom),10px)] pt-2 text-center text-xs text-white/40 font-medium">
          {mode === 'duel' ? 'Игрок 1: W A S D · Игрок 2: стрелки · P — пауза' : touch ? 'Свайпы — поворот' : 'Стрелки / WASD · Пробел — ускорение · P — пауза'}
        </div>
      )}

      {/* Pause */}
      <Modal open={paused && !result} onClose={togglePause}>
        <div className="p-6 text-center">
          <Emoji name="snail" size={72} className="mx-auto animate-float" />
          <h2 className="font-display font-black text-3xl mt-2">Пауза</h2>
          {level && <p className="text-white/60 mt-1">Уровень {level.id}: {level.name}</p>}
          {mode === 'daily' || mode === 'classic' ? (
            <div className="flex flex-wrap justify-center gap-1.5 mt-3">
              {engineRef.current && [...engineRef.current.mutators].map((m) => (
                <span key={m} className="glass rounded-full pl-1 pr-3 py-1 text-xs flex items-center gap-1"><Emoji name={mutatorById(m).sprite} size={18} />{mutatorById(m).name}</span>
              ))}
            </div>
          ) : null}
          <div className="grid gap-3 mt-6">
            <Button size="lg" full onClick={togglePause}><Play size={22} fill="currentColor" /> Продолжить</Button>
            <div className="grid grid-cols-2 gap-3">
              <Button tone="blue" full onClick={replay}><RotateCcw size={18} /> Заново</Button>
              <Button tone="slate" full onClick={exitToMenu}><Home size={18} /> Меню</Button>
            </div>
          </div>
          <div className="mt-6 grid gap-2 text-left">
            <SettingRow icon={profile.settings.sfx ? <Volume2 size={18} /> : <VolumeX size={18} />} label="Звуки">
              <Toggle on={profile.settings.sfx} onChange={(v) => { setProfile((p) => { p.settings.sfx = v; }); audio.sfxOn = v; }} />
            </SettingRow>
            <SettingRow icon={<Music size={18} />} label="Музыка">
              <Toggle on={profile.settings.music} onChange={(v) => { setProfile((p) => { p.settings.music = v; }); audio.setMusic(v); }} />
            </SettingRow>
          </div>
        </div>
      </Modal>

      {/* Results */}
      <Modal open={!!result}>
        {result && (
          <Results
            run={result.run}
            reward={result.reward}
            levelName={level?.name}
            onReplay={replay}
            onMenu={exitToMenu}
            onNext={nextLevel && result.run.win ? () => onRelaunch({ mode: 'campaign', levelId: nextLevel.id }) : undefined}
          />
        )}
      </Modal>
    </div>
  );
}

function SettingRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-2.5">
      <span className="text-white/70">{icon}</span>
      <span className="flex-1 font-semibold">{label}</span>
      {children}
    </div>
  );
}

function ScoreBlock({ hud }: { hud: Hud | null }) {
  const score = useCountUp(hud?.score ?? 0, 0.25);
  const [bump, setBump] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (hud && hud.score > prev.current) setBump((b) => b + 1);
    prev.current = hud?.score ?? 0;
  }, [hud?.score, hud]);
  return (
    <div className="glass rounded-2xl pl-2 pr-4 h-11 flex items-center gap-2">
      <Emoji name="apple" size={28} />
      <motion.span key={bump} initial={{ scale: 1.35 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }}
        className="font-display font-black text-xl tabular-nums min-w-[3ch]">
        {score}
      </motion.span>
      {hud && hud.length > 0 && <span className="text-xs text-white/50 font-semibold hidden sm:inline">длина {hud.length}</span>}
    </div>
  );
}

function fmtTime(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function ModeInfo({ hud, mode, levelGoal, hasRival }: { hud: Hud | null; mode: Launch['mode']; levelGoal?: number; hasRival: boolean }) {
  if (!hud) return null;
  const pill = 'glass rounded-2xl px-3 h-11 flex items-center gap-2 font-display font-bold tabular-nums';
  switch (mode) {
    case 'campaign':
      return (
        <div className="flex gap-2">
          <div className={pill}><Emoji name="apple" size={22} />{hud.fruits}/{levelGoal}</div>
          {hasRival && (
            <div className={`${pill} text-orange-300`}><Emoji name="flag" size={22} />{hud.rivalFruits}/{levelGoal}</div>
          )}
          <div className={`${pill} hidden sm:flex text-white/80`}><Emoji name="hourglass" size={20} />{fmtTime(hud.time)}</div>
        </div>
      );
    case 'blitz':
    case 'arena':
      return (
        <div className="flex gap-2">
          {mode === 'arena' && <div className={pill}><Emoji name={hud.rank === 1 ? 'medal1' : hud.rank === 2 ? 'medal2' : hud.rank === 3 ? 'medal3' : 'medal'} size={22} />#{hud.rank}</div>}
          <div className={`${pill} ${hud.timeLeft < 10000 ? 'text-rose-300 animate-pulse' : ''}`}>
            <Emoji name="stopwatch" size={22} />{fmtTime(hud.timeLeft)}
          </div>
        </div>
      );
    case 'duel':
      return (
        <div className={pill}>
          <span className="w-3 h-3 rounded-full bg-emerald-400" />{hud.duelWins[0]}
          <span className="text-white/40">:</span>
          {hud.duelWins[1]}<span className="w-3 h-3 rounded-full bg-orange-400" />
        </div>
      );
    default:
      return <BestPill mode={mode} />;
  }
}

function BestPill({ mode }: { mode: Launch['mode'] }) {
  const p = useProfile();
  const best = mode === 'daily' ? p.daily.best : p.best[mode] ?? 0;
  return (
    <div className="glass rounded-2xl px-3 h-11 flex items-center gap-2 font-display font-bold tabular-nums text-amber-200">
      <Emoji name="trophy" size={22} />{best}
    </div>
  );
}

function DPad({ onPress }: { onPress: (d: Dir) => void }) {
  const btn = 'glass rounded-2xl w-[58px] h-[58px] grid place-items-center text-2xl active:bg-white/25 active:scale-95 transition select-none';
  const make = (d: Dir, label: string, cls: string) => (
    <button className={`${btn} ${cls}`} onPointerDown={(e) => { e.preventDefault(); onPress(d); }} aria-label={label}>
      <svg width="22" height="22" viewBox="0 0 24 24" style={{ transform: `rotate(${d * 90}deg)` }}><path d="M12 4 L21 17 H3 Z" fill="white" opacity="0.9" /></svg>
    </button>
  );
  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-1.5 game-surface">
      {make(0, 'Вверх', 'col-start-2 row-start-1')}
      {make(3, 'Влево', 'col-start-1 row-start-2')}
      {make(1, 'Вправо', 'col-start-3 row-start-2')}
      {make(2, 'Вниз', 'col-start-2 row-start-3')}
    </div>
  );
}

function BoostButton({ onChange }: { onChange: (on: boolean) => void }) {
  const [on, setOn] = useState(false);
  const set = (v: boolean) => { setOn(v); onChange(v); };
  return (
    <button
      className={`game-surface w-20 h-20 rounded-full grid place-items-center font-display font-bold text-xs transition border-2 ${on ? 'bg-amber-400/40 border-amber-300 scale-95' : 'glass border-white/20'}`}
      onPointerDown={(e) => { e.preventDefault(); set(true); }}
      onPointerUp={() => set(false)}
      onPointerLeave={() => set(false)}
      onPointerCancel={() => set(false)}
    >
      <div className="flex flex-col items-center gap-0.5"><Zap size={26} fill="currentColor" className="text-amber-300" />РЫВОК</div>
    </button>
  );
}

// ─── Results ────────────────────────────────────────────────────────────────

function Results({ run, reward, levelName, onReplay, onMenu, onNext }: {
  run: RunResult; reward: RunReward; levelName?: string; onReplay: () => void; onMenu: () => void; onNext?: () => void;
}) {
  const score = useCountUp(run.score, 1);
  const coins = useCountUp(reward.coins, 1.2);
  const p = useProfile();

  let title = 'Игра окончена';
  let sprite = 'skull';
  let subtitle = '';
  switch (run.mode) {
    case 'campaign':
      if (run.win) { title = 'Уровень пройден!'; sprite = 'trophy'; }
      else { title = run.reason === 'rival' ? 'Соперник успел первым' : 'Не получилось'; sprite = run.reason === 'rival' ? 'flag' : 'skull'; }
      subtitle = levelName ?? '';
      break;
    case 'arena':
      title = run.win ? 'Победа на арене!' : run.reason === 'time' ? `Место #${run.rank}` : 'Тебя съели!';
      sprite = run.win ? 'crown' : run.reason === 'time' ? 'medal' : 'skull';
      break;
    case 'blitz':
      title = 'Время вышло!'; sprite = 'stopwatch';
      break;
    case 'duel':
      title = run.duelWinner === null ? 'Ничья!' : `Победил игрок ${run.duelWinner! + 1}!`;
      sprite = 'party';
      break;
    case 'daily':
      title = run.win ? 'Испытание пройдено!' : 'Почти получилось!';
      sprite = run.win ? 'party' : 'calendar';
      break;
    default:
      title = reward.newBest ? 'Новый рекорд!' : 'Игра окончена';
      sprite = reward.newBest ? 'trophy' : 'snake';
  }
  if (run.mode !== 'campaign' && run.mode !== 'duel' && reward.newBest && run.mode !== 'classic') subtitle = 'Новый рекорд!';

  const tiles: { sprite: string; label: string; value: string | number }[] = run.mode === 'duel'
    ? [{ sprite: 'gamepad', label: 'Счёт', value: `${run.duelScore?.[0]} : ${run.duelScore?.[1]}` }, { sprite: 'hourglass', label: 'Время', value: fmtTime(run.timeMs) }]
    : [
      { sprite: 'snake', label: 'Длина', value: run.length },
      { sprite: 'apple', label: 'Фрукты', value: run.fruits },
      { sprite: 'fire', label: 'Комбо', value: run.maxCombo },
      run.mode === 'arena' ? { sprite: 'skull', label: 'Съедено', value: run.kills } : { sprite: 'hourglass', label: 'Время', value: fmtTime(run.timeMs) },
    ];

  const level = run.levelId ? LEVELS.find((l) => l.id === run.levelId) : undefined;

  return (
    <div className="p-6 text-center">
      <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 12 }}>
        <Emoji name={sprite} size={88} className="mx-auto animate-float" />
      </motion.div>
      <h2 className="font-display font-black text-3xl mt-2 leading-tight">{title}</h2>
      {subtitle && <p className="text-amber-200 font-semibold mt-1">{subtitle}</p>}

      {run.mode === 'campaign' && run.win && (
        <div className="flex justify-center mt-3"><Stars count={run.stars} size={44} animateIn /></div>
      )}
      {level && run.win && run.stars < 3 && (
        <p className="text-xs text-white/50 mt-2">3 звезды — быстрее {levelPar(level)[1]} сек, 2 звезды — быстрее {levelPar(level)[0]} сек</p>
      )}

      {run.mode !== 'duel' && (
        <div className="mt-4">
          <div className="text-white/50 text-xs uppercase tracking-widest font-bold">Очки</div>
          <div className="font-display font-black text-5xl tabular-nums">{score}</div>
          {run.mode === 'daily' && (
            <div className="text-sm text-white/60 mt-1">Цель испытания: {dailyChallenge().goalScore}</div>
          )}
          {reward.newBest && run.mode !== 'campaign' && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.8, type: 'spring' }}
              className="inline-flex mt-2 items-center gap-1.5 rounded-full bg-amber-400/20 border border-amber-300/50 px-3 py-1 text-amber-200 text-sm font-bold">
              <Emoji name="glowing_star" size={18} /> Рекорд! (был {reward.prevBest})
            </motion.div>
          )}
        </div>
      )}

      <div className={`grid gap-2 mt-4 ${tiles.length === 4 ? 'grid-cols-4' : 'grid-cols-2'}`}>
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl bg-white/6 border border-white/10 py-2">
            <Emoji name={t.sprite} size={22} className="mx-auto" />
            <div className="font-display font-bold tabular-nums mt-0.5">{t.value}</div>
            <div className="text-[10px] text-white/50 uppercase font-bold">{t.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl bg-gradient-to-r from-amber-400/15 to-orange-500/10 border border-amber-300/25 p-3">
        <div className="flex items-center justify-center gap-2 font-display font-black text-2xl text-amber-200">
          +{coins} <Emoji name="coin" size={30} />
        </div>
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 mt-1 text-xs text-white/60">
          {reward.breakdown.map((b) => <span key={b.label}>{b.label}: +{b.value}</span>)}
          <span>Опыт: +{reward.xp}</span>
        </div>
        {reward.levelUp && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1, type: 'spring' }}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 border border-emerald-300/50 px-3 py-1 text-emerald-200 text-sm font-bold">
            <Emoji name="sparkles" size={18} /> Новый уровень: {reward.levelUp}!
          </motion.div>
        )}
      </div>

      {reward.quests.length > 0 && (
        <div className="mt-3 grid gap-1.5">
          {reward.quests.map((id) => {
            const q = p.quests.list.find((x) => x.id === id);
            return (
              <div key={id} className="rounded-xl bg-emerald-400/10 border border-emerald-300/30 px-3 py-2 text-sm flex items-center gap-2">
                <Emoji name="check" size={20} />
                <span className="flex-1 text-left">Задание: {q ? questDef(id).text(q.target) : id}</span>
                <span className="text-emerald-200 text-xs font-bold">забери награду</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid gap-3 mt-5">
        {onNext ? (
          <Button size="lg" full onClick={onNext}>Дальше <ChevronRight size={22} /></Button>
        ) : (
          <Button size="lg" full onClick={onReplay}><RotateCcw size={20} /> Ещё раз</Button>
        )}
        <div className="grid grid-cols-2 gap-3">
          {onNext ? <Button tone="blue" full onClick={onReplay}><RotateCcw size={18} /> Заново</Button> : <div className="hidden" />}
          <Button tone="slate" full className={onNext ? '' : 'col-span-2'} onClick={onMenu}><Home size={18} /> Меню</Button>
        </div>
      </div>
    </div>
  );
}

