import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'framer-motion';
import { Home, Pause, Play, RotateCcw, Volume2, VolumeX, Music, ChevronRight, Zap, RotateCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { audio, vibrate } from '../audio/audio';
import { preload } from '../game/assets';
import { FRUITS, POWERS, skinById, mutatorById, HATS, THEMES } from '../game/content';
import { Engine } from '../game/engine';
import { buildConfig, dailyChallenge, type Launch } from '../game/launch';
import { LEVELS, levelPar } from '../game/levels';
import { Renderer } from '../game/renderer';
import type { Dir, GameEvent, PowerId, RunResult } from '../game/types';
import { applyRun, getProfile, setProfile, useProfile, type RunReward, type Settings, questDef } from '../store/profile';
import { useCountUp, useViewport } from '../ui/hooks';
import { Button, Emoji, IconButton, Modal, StatTile, Stars, Toggle } from '../ui/kit';
import { useGameInput } from '../ui/useGameInput';
import { toastAchievements } from '../ui/toastStore';

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
    board:
      e.cfg.mode === 'arena'
        ? [...e.snakes]
            .sort((a, b) => b.score - a.score)
            .map((s) => ({ name: s.name, score: s.score, color: skinById(s.skin).preview[0], alive: s.alive, me: s.controller === 'p1' }))
        : [],
    duelWins: [...e.duelWins] as [number, number],
    round: e.round,
    roundWinner: e.lastRoundWinner,
    alive: p.alive,
  };
}

const KEY_DIR: Record<string, [Dir, 'p1' | 'p2' | 'any']> = {
  ArrowUp: [0, 'p2'],
  ArrowRight: [1, 'p2'],
  ArrowDown: [2, 'p2'],
  ArrowLeft: [3, 'p2'],
  KeyW: [0, 'p1'],
  KeyD: [1, 'p1'],
  KeyS: [2, 'p1'],
  KeyA: [3, 'p1'],
};

/** `light` covers turns and deaths; `full` adds the per-pickup taps. */
function haptic(level: Settings['haptics'], pattern: number | number[], weight: 'light' | 'full' = 'full') {
  if (level === 'off') return;
  if (level === 'light' && weight === 'full') return;
  vibrate(pattern);
}

function playEventSounds(events: GameEvent[], e: Engine, haptics: Settings['haptics']) {
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
        if (mine) haptic(haptics, ev.kind === 'golden' ? 40 : 12, 'full');
        break;
      case 'die':
        if (mine) {
          audio.play('die');
          haptic(haptics, [60, 40, 120], 'light');
        } else audio.play('kill', { volume: ev.by !== undefined && e.snakes[ev.by]?.controller === 'p1' ? 1 : 0.35 });
        break;
      case 'shield':
        audio.play('shield');
        haptic(haptics, 50, 'light');
        break;
      case 'portal':
        audio.play('portal', { volume: vol });
        break;
      case 'rock':
        audio.play('rock', { volume: 0.7 });
        break;
      case 'powerEnd':
        if (mine) audio.play('powerEnd');
        break;
      case 'timeUp':
        audio.play('go');
        break;
      case 'round':
        audio.play('go');
        break;
    }
  }
}

export function GameScreen({ launch, onExit, onRelaunch }: { launch: Launch; onExit: () => void; onRelaunch: (l: Launch) => void }) {
  const profile = useProfile();
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const joystickRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [paused, setPaused] = useState(false);
  const [rotated, setRotated] = useState(false);
  const [result, setResult] = useState<{ run: RunResult; reward: RunReward } | null>(null);
  const settingsRef = useRef(profile.settings);
  settingsRef.current = profile.settings;
  const [showHint] = useState(() => !getProfile().tutorialSeen);

  const mode = launch.mode;
  // App remounts this component for every launch (keyed on `game.key`), so the
  // launch is frozen for the component's life. Holding it in a ref lets the
  // engine effect declare an honestly empty dependency list.
  const launchRef = useRef(launch);
  const level = launch.mode === 'campaign' ? LEVELS.find((l) => l.id === launch.levelId) : undefined;
  const { coarse: touch, landscape, short, device } = useViewport();
  const scheme = profile.settings.control;
  // Duel is two players on one keyboard; touch controls cannot serve both.
  const touchControls = touch && mode !== 'duel';
  const showDpad = touchControls && scheme === 'dpad';
  const canBoost = mode === 'arena' || mode === 'classic' || mode === 'daily' || mode === 'blitz';
  const showBoost = touchControls && canBoost && scheme !== 'tap';
  const leftHanded = profile.settings.handedness === 'left';

  // Controls float over the board; these insets keep the board clear of them.
  const insets = useMemo(() => {
    const top = short ? 44 : 60;
    if (!showDpad && !showBoost) return { top, bottom: 12 };
    return landscape ? { top, bottom: 12, left: 128, right: 128 } : { top, bottom: 168 };
  }, [short, landscape, showDpad, showBoost]);
  const insetsRef = useRef(insets);
  insetsRef.current = insets;

  // ── Engine + render loop ──
  useEffect(() => {
    const canvas = canvasRef.current!;
    const container = containerRef.current!;
    const p = getProfile();
    const portrait = window.innerHeight > window.innerWidth * 1.05;
    const engine = new Engine(buildConfig(launchRef.current, p, portrait));
    engineRef.current = engine;
    if (import.meta.env.DEV) (window as unknown as { __engine: Engine }).__engine = engine;
    const renderer = new Renderer(canvas, engine, p.equipped.theme);
    rendererRef.current = renderer;
    renderer.reducedFx = p.settings.reducedFx;

    void preload([
      ...FRUITS,
      'golden',
      'coin',
      'key',
      'locked',
      'mushroom',
      'stopwatch',
      ...Object.values(POWERS).map((x) => x.sprite),
      ...HATS.map((h) => h.sprite).filter(Boolean),
      ...THEMES.map((t) => t.rock),
    ]);

    const fit = () => renderer.resize(container.clientWidth, container.clientHeight, insetsRef.current);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(container);

    const runMode = launchRef.current.mode;
    audio.setTrack('game', runMode === 'blitz' ? 1.15 : 1);
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
        playEventSounds(events, engine, settingsRef.current.haptics);
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
          if (runMode === 'duel' ? run.duelWinner !== null : good) {
            audio.win();
            if (!getProfile().settings.reducedFx) {
              confetti({
                particleCount: 120,
                spread: 80,
                origin: { y: 0.35 },
                zIndex: 70,
                colors: ['#3bbf6b', '#e3b04b', '#8b6fd4', '#4a8fd9'],
              });
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
  }, []);

  // Re-letterboard the board whenever the reserved space changes.
  useEffect(() => {
    const c = containerRef.current;
    if (c) rendererRef.current?.resize(c.clientWidth, c.clientHeight, insets);
  }, [insets]);

  // The board keeps the orientation it was built with — rebuilding mid-run
  // would destroy the run — but a rotation should not cost the player a life.
  const firstOrientation = useRef(landscape);
  useEffect(() => {
    if (landscape === firstOrientation.current) {
      setRotated(false);
      return;
    }
    setRotated(true);
    const e = engineRef.current;
    if (e && (e.phase === 'playing' || e.phase === 'countdown')) {
      e.pause();
      setPaused(true);
    }
  }, [landscape]);

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

  /** Single path for every turn, so feedback is consistent across schemes. */
  const turn = useCallback((dir: Dir) => {
    audio.unlock();
    const e = engineRef.current;
    if (!e || !e.input('p1', dir)) return;
    rendererRef.current?.showTurnHint(e.player?.queue.at(-1) ?? dir);
    haptic(settingsRef.current.haptics, 8, 'light');
    if (settingsRef.current.turnSound) audio.play('turn');
  }, []);

  const turnRelative = useCallback((delta: -1 | 1) => {
    audio.unlock();
    const e = engineRef.current;
    if (!e || !e.inputRelative('p1', delta)) return;
    const queued = e.player?.queue.at(-1);
    if (queued !== undefined) rendererRef.current?.showTurnHint(queued);
    haptic(settingsRef.current.haptics, 8, 'light');
    if (settingsRef.current.turnSound) audio.play('turn');
  }, []);

  useGameInput(rootRef, {
    scheme,
    sensitivity: profile.settings.swipeSensitivity,
    enabled: touchControls && !paused && !result,
    onDir: turn,
    onRelative: turnRelative,
    joystickRef,
  });

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
      if (mode === 'duel' && who === 'p2') {
        e.input('p2', dir);
        if (settingsRef.current.turnSound) audio.play('turn');
        return;
      }
      turn(dir);
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
  }, [mode, togglePause, replay, result, turn]);

  const exitToMenu = () => {
    setPaused(false);
    onExit();
  };

  const nextLevel = level ? LEVELS.find((l) => l.id === level.id + 1) : undefined;
  const controlSide = leftHanded ? 'right-4' : 'left-4';
  const boostSide = leftHanded ? 'left-4' : 'right-4';

  return (
    <div ref={rootRef} className="absolute inset-0 app-bg game-surface overflow-hidden">
      {/* Board fills the screen; everything else floats above it. The nudge
          re-centres it between the HUD and the controls rather than on the
          raw viewport, so the reserved space is split evenly. */}
      <div
        ref={containerRef}
        className="absolute inset-0 grid place-items-center"
        style={{
          transform: `translate(${((insets.left ?? 0) - (insets.right ?? 0)) / 2}px, ${((insets.top ?? 0) - (insets.bottom ?? 0)) / 2}px)`,
        }}
      >
        <canvas ref={canvasRef} className="block drop-shadow-[0_18px_36px_rgba(0,0,0,0.5)]" />
      </div>

      {/* HUD */}
      <div className="absolute top-0 inset-x-0 z-10 safe-x px-3 pt-[max(var(--sat),8px)] pointer-events-none">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <div className="pointer-events-auto" data-no-swipe>
            <IconButton label="Пауза" onClick={togglePause}>
              <Pause size={20} />
            </IconButton>
          </div>
          <ScoreBlock hud={hud} compact={short} />
          <div className="flex-1" />
          <ModeInfo hud={hud} mode={mode} levelGoal={level?.goal} hasRival={!!level?.rival} compact={short} />
        </div>

        <div className="max-w-3xl mx-auto mt-1.5 flex items-center gap-2 min-h-[30px] flex-wrap">
          <AnimatePresence>
            {hud?.powers.map((pw) => (
              <motion.div
                key={pw.id}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="relative w-[30px] h-[30px]"
              >
                <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
                  <circle cx="18" cy="18" r="16" fill="rgba(0,0,0,0.45)" stroke="rgba(255,255,255,0.14)" strokeWidth="3" />
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    stroke={POWERS[pw.id].color}
                    strokeWidth="3"
                    strokeDasharray={`${pw.pct * 100.5} 100.5`}
                    strokeLinecap="round"
                  />
                </svg>
                <Emoji name={POWERS[pw.id].sprite} size={19} className="absolute inset-0 m-auto" />
              </motion.div>
            ))}
            {hud?.shield && (
              <motion.div
                key="shield"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="overlay-glass rounded-full w-[30px] h-[30px] grid place-items-center"
              >
                <Emoji name="shield" size={19} />
              </motion.div>
            )}
            {hud?.reversed && (
              <motion.div
                key="rev"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="rounded-full px-3 h-[30px] flex items-center gap-1.5 bg-accent/25 border border-accent/40 text-accent-soft text-xs font-bold"
              >
                <Emoji name="mushroom" size={18} className="animate-wiggle" /> Наоборот!
              </motion.div>
            )}
          </AnimatePresence>
          {hud && hud.combo >= 2 && (
            <div className="ml-auto flex items-center gap-2">
              <span className="font-display font-extrabold text-sm text-reward">×{hud.mult}</span>
              <div className="w-16 h-1.5 rounded-full bg-black/40 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-reward to-reward-soft" style={{ width: `${hud.comboPct * 100}%` }} />
              </div>
              <span className="text-[11px] text-fg-mute font-semibold">комбо {hud.combo}</span>
            </div>
          )}
        </div>

        {mode === 'arena' && hud && <ArenaBoard board={hud.board} rank={hud.rank} compact={device === 'phone' && !landscape} />}
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {hud && hud.phase === 'countdown' && !paused && (
          <motion.div
            key={`cd-${hud.countdown}-${hud.round}`}
            className="absolute inset-0 grid place-items-center pointer-events-none z-20"
            initial={{ scale: 2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          >
            <div className="text-center px-6">
              {mode === 'duel' && hud.round > 1 && (
                <div className="font-display text-xl font-bold mb-2 text-fg [text-shadow:0_3px_12px_rgba(0,0,0,.7)]">Раунд {hud.round}</div>
              )}
              <div
                className="font-display font-black leading-none text-fg [text-shadow:0_5px_0_rgba(0,0,0,.4),0_16px_32px_rgba(0,0,0,.6)]"
                style={{ fontSize: short ? 64 : 96 }}
              >
                {hud.countdown}
              </div>
              {level && hud.round === 1 && hud.time === 0 ? (
                <div className="glass-strong rounded-panel px-4 py-3 mt-6 text-sm font-semibold max-w-xs mx-auto flex items-center gap-3 text-left">
                  <Emoji name={level.sprite} size={34} />
                  <span>{level.tip}</span>
                </div>
              ) : showHint && hud.time === 0 ? (
                <div className="glass-strong rounded-panel px-4 py-3 mt-6 text-sm font-semibold max-w-xs mx-auto">
                  {touchControls ? HINTS[scheme] : 'Стрелки или WASD — поворот, Пробел — ускорение, P — пауза'}
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
        {hud && hud.phase === 'roundOver' && (
          <motion.div
            key="round"
            className="absolute inset-0 grid place-items-center pointer-events-none z-20"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="glass-strong rounded-panel px-8 py-5 text-center">
              <div className="font-display font-black text-2xl">
                {hud.roundWinner === null ? 'Ничья!' : `Раунд за игроком ${hud.roundWinner + 1}`}
              </div>
              <div className="font-display text-4xl mt-2 font-black tabular-nums">
                {hud.duelWins[0]} : {hud.duelWins[1]}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating joystick ring, positioned imperatively so steering never re-renders. */}
      {touchControls && scheme === 'joystick' && (
        <div
          ref={joystickRef}
          className="absolute top-0 left-0 w-28 h-28 rounded-full border-2 border-line-strong bg-white/[0.06] pointer-events-none opacity-0 transition-opacity z-10"
        >
          <span className="absolute inset-0 m-auto w-10 h-10 rounded-full bg-white/[0.12]" />
        </div>
      )}

      {/* Touch controls, in the thumb arc rather than centred in a row. */}
      {showDpad && (
        <div
          className={`absolute z-10 ${controlSide} bottom-[max(var(--sab),18px)] ${leftHanded ? 'mr-[max(var(--sar),0px)]' : 'ml-[max(var(--sal),0px)]'}`}
          data-no-swipe
        >
          <DPad onPress={turn} />
        </div>
      )}
      {showBoost && (
        <div
          className={`absolute z-10 ${boostSide} bottom-[max(var(--sab),26px)] ${leftHanded ? 'ml-[max(var(--sal),0px)]' : 'mr-[max(var(--sar),0px)]'}`}
          data-no-swipe
        >
          <BoostButton onChange={(on) => engineRef.current?.setBoost('p1', on)} />
        </div>
      )}
      {!touchControls && (
        <div className="absolute bottom-0 inset-x-0 pb-[max(var(--sab),10px)] text-center text-xs text-fg-mute font-medium pointer-events-none">
          {mode === 'duel' ? 'Игрок 1: W A S D · Игрок 2: стрелки · P — пауза' : 'Стрелки / WASD · Пробел — ускорение · P — пауза'}
        </div>
      )}

      {/* Rotation notice: the board keeps its orientation until the next run. */}
      <AnimatePresence>
        {rotated && paused && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-[max(var(--sab),20px)] inset-x-0 z-30 flex justify-center px-4 pointer-events-none"
          >
            <div className="overlay-glass rounded-full px-4 py-2 text-xs font-semibold flex items-center gap-2">
              <RotateCw size={16} /> Поле сохранит ориентацию до конца забега
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pause */}
      <Modal open={paused && !result} onClose={togglePause}>
        <div className="p-6 text-center">
          <Emoji name="snail" size={64} className="mx-auto animate-float" />
          <h2 className="font-display font-black text-3xl mt-2">Пауза</h2>
          {level && (
            <p className="text-fg-soft mt-1">
              Уровень {level.id}: {level.name}
            </p>
          )}
          {mode === 'daily' || mode === 'classic' ? (
            <div className="flex flex-wrap justify-center gap-1.5 mt-3">
              {engineRef.current &&
                [...engineRef.current.mutators].map((m) => (
                  <span key={m} className="glass rounded-full pl-1 pr-3 py-1 text-xs flex items-center gap-1">
                    <Emoji name={mutatorById(m).sprite} size={18} />
                    {mutatorById(m).name}
                  </span>
                ))}
            </div>
          ) : null}
          <div className="grid gap-3 mt-6">
            <Button size="lg" full onClick={togglePause}>
              <Play size={22} fill="currentColor" /> Продолжить
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button tone="info" full onClick={replay}>
                <RotateCcw size={18} /> Заново
              </Button>
              <Button tone="neutral" full onClick={exitToMenu}>
                <Home size={18} /> Меню
              </Button>
            </div>
          </div>
          <div className="mt-6 grid gap-2 text-left">
            <SettingRow icon={profile.settings.sfx ? <Volume2 size={18} /> : <VolumeX size={18} />} label="Звуки">
              <Toggle
                on={profile.settings.sfx}
                onChange={(v) => {
                  setProfile((p) => {
                    p.settings.sfx = v;
                  });
                  audio.sfxOn = v;
                }}
              />
            </SettingRow>
            <SettingRow icon={<Music size={18} />} label="Музыка">
              <Toggle
                on={profile.settings.music}
                onChange={(v) => {
                  setProfile((p) => {
                    p.settings.music = v;
                  });
                  audio.setMusic(v);
                }}
              />
            </SettingRow>
          </div>
          {touchControls && (
            <div className="mt-4 text-left">
              <div className="text-[11px] uppercase tracking-wider font-bold text-fg-mute mb-1.5">Управление</div>
              <div className="grid grid-cols-4 gap-1.5">
                {(Object.keys(SCHEME_LABEL) as (keyof typeof SCHEME_LABEL)[]).map((id) => (
                  <button
                    key={id}
                    onClick={() => {
                      audio.play('click');
                      setProfile((p) => {
                        p.settings.control = id;
                      });
                    }}
                    className={`rounded-sm py-2 text-xs font-bold transition ${scheme === id ? 'bg-ink-600 text-fg' : 'bg-white/[0.04] text-fg-mute'}`}
                  >
                    {SCHEME_LABEL[id]}
                  </button>
                ))}
              </div>
            </div>
          )}
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

export const SCHEME_LABEL = { swipe: 'Свайпы', joystick: 'Стик', dpad: 'Крест', tap: 'Тапы' } as const;

const HINTS: Record<string, string> = {
  swipe: 'Проводи пальцем в любом месте экрана — змейка повернёт сразу',
  joystick: 'Держи палец на экране и веди в нужную сторону',
  dpad: 'Жми стрелки внизу экрана',
  tap: 'Тапай слева — поворот влево, справа — вправо',
};

function SettingRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-card bg-white/[0.04] px-4 py-2.5">
      <span className="text-fg-soft">{icon}</span>
      <span className="flex-1 font-semibold">{label}</span>
      {children}
    </div>
  );
}

/** Top three plus your own row, for phones where the full panel does not fit. */
function ArenaBoard({ board, rank, compact }: { board: Hud['board']; rank: number; compact: boolean }) {
  if (!board.length) return null;
  if (compact) {
    const top = board.slice(0, 3);
    const me = board.findIndex((b) => b.me);
    const rows = me >= 3 && board[me] ? [...top, board[me]] : top;
    return (
      <div className="max-w-3xl mx-auto mt-1.5 flex items-center gap-2 overflow-hidden text-[11px] font-semibold">
        {rows.map((b, i) => (
          <span
            key={i}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${b.me ? 'bg-white/[0.12] text-fg' : 'bg-black/30 text-fg-soft'} ${b.alive ? '' : 'opacity-40'}`}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: b.color }} />
            <span className="tabular-nums">{b.me ? `#${rank}` : i + 1}</span>
            <span className="tabular-nums">{b.score}</span>
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="absolute top-[max(var(--sat),8px)] right-3 overlay-glass rounded-card p-2 text-[11px] w-32 pointer-events-none">
      {board.slice(0, 6).map((b, i) => (
        <div
          key={i}
          className={`flex items-center gap-1.5 py-0.5 ${b.me ? 'font-bold text-fg' : 'text-fg-soft'} ${b.alive ? '' : 'opacity-40'}`}
        >
          <span className="w-3 text-fg-mute">{i + 1}</span>
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: b.color }} />
          <span className="flex-1 truncate">{b.name}</span>
          <span className="tabular-nums">{b.score}</span>
        </div>
      ))}
    </div>
  );
}

function ScoreBlock({ hud, compact }: { hud: Hud | null; compact: boolean }) {
  const score = useCountUp(hud?.score ?? 0, 0.25);
  const [bump, setBump] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (hud && hud.score > prev.current) setBump((b) => b + 1);
    prev.current = hud?.score ?? 0;
  }, [hud?.score, hud]);
  return (
    <div className={`overlay-glass rounded-card pl-2 pr-3.5 flex items-center gap-2 ${compact ? 'h-9' : 'h-11'}`}>
      <Emoji name="apple" size={compact ? 22 : 26} />
      <motion.span
        key={bump}
        initial={{ scale: 1.3 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 15 }}
        className={`font-display font-black tabular-nums min-w-[3ch] ${compact ? 'text-base' : 'text-xl'}`}
      >
        {score}
      </motion.span>
      {hud && hud.length > 0 && !compact && <span className="text-xs text-fg-mute font-semibold hidden sm:inline">длина {hud.length}</span>}
    </div>
  );
}

function fmtTime(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function ModeInfo({
  hud,
  mode,
  levelGoal,
  hasRival,
  compact,
}: {
  hud: Hud | null;
  mode: Launch['mode'];
  levelGoal?: number;
  hasRival: boolean;
  compact: boolean;
}) {
  if (!hud) return null;
  const pill = `overlay-glass rounded-card px-3 flex items-center gap-2 font-display font-bold tabular-nums ${compact ? 'h-9 text-sm' : 'h-11'}`;
  const icon = compact ? 18 : 22;
  switch (mode) {
    case 'campaign':
      return (
        <div className="flex gap-2">
          <div className={pill}>
            <Emoji name="apple" size={icon} />
            {hud.fruits}/{levelGoal}
          </div>
          {hasRival && (
            <div className={`${pill} text-reward`}>
              <Emoji name="flag" size={icon} />
              {hud.rivalFruits}/{levelGoal}
            </div>
          )}
          <div className={`${pill} hidden sm:flex text-fg-soft`}>
            <Emoji name="hourglass" size={icon - 2} />
            {fmtTime(hud.time)}
          </div>
        </div>
      );
    case 'blitz':
    case 'arena':
      return (
        <div className="flex gap-2">
          {mode === 'arena' && (
            <div className={pill}>
              <Emoji name={hud.rank === 1 ? 'medal1' : hud.rank === 2 ? 'medal2' : hud.rank === 3 ? 'medal3' : 'medal'} size={icon} />#
              {hud.rank}
            </div>
          )}
          <div className={`${pill} ${hud.timeLeft < 10000 ? 'text-danger-soft animate-pulse' : ''}`}>
            <Emoji name="stopwatch" size={icon} />
            {fmtTime(hud.timeLeft)}
          </div>
        </div>
      );
    case 'duel':
      return (
        <div className={pill}>
          <span className="w-3 h-3 rounded-full bg-accent" />
          {hud.duelWins[0]}
          <span className="text-fg-mute">:</span>
          {hud.duelWins[1]}
          <span className="w-3 h-3 rounded-full bg-reward" />
        </div>
      );
    default:
      return <BestPill mode={mode} compact={compact} />;
  }
}

function BestPill({ mode, compact }: { mode: Launch['mode']; compact: boolean }) {
  const p = useProfile();
  const best = mode === 'daily' ? p.daily.best : (p.best[mode] ?? 0);
  return (
    <div
      className={`overlay-glass rounded-card px-3 flex items-center gap-2 font-display font-bold tabular-nums text-reward-soft ${compact ? 'h-9 text-sm' : 'h-11'}`}
    >
      <Emoji name="trophy" size={compact ? 18 : 22} />
      {best}
    </div>
  );
}

function DPad({ onPress }: { onPress: (d: Dir) => void }) {
  const btn =
    'overlay-glass rounded-card w-[56px] h-[56px] grid place-items-center border-line-strong active:bg-white/[0.18] active:scale-95 transition select-none';
  const make = (d: Dir, label: string, cls: string) => (
    <button
      className={`${btn} ${cls}`}
      onPointerDown={(e) => {
        e.preventDefault();
        onPress(d);
      }}
      aria-label={label}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" style={{ transform: `rotate(${d * 90}deg)` }}>
        <path d="M12 4 L21 17 H3 Z" fill="white" />
      </svg>
    </button>
  );
  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-2 game-surface opacity-90">
      {make(0, 'Вверх', 'col-start-2 row-start-1')}
      {make(3, 'Влево', 'col-start-1 row-start-2')}
      {make(1, 'Вправо', 'col-start-3 row-start-2')}
      {make(2, 'Вниз', 'col-start-2 row-start-3')}
    </div>
  );
}

function BoostButton({ onChange }: { onChange: (on: boolean) => void }) {
  const [on, setOn] = useState(false);
  const set = (v: boolean) => {
    setOn(v);
    onChange(v);
  };
  return (
    <button
      className={`game-surface w-[72px] h-[72px] rounded-full grid place-items-center font-display font-bold text-[10px] transition border-2 ${on ? 'bg-reward/40 border-reward scale-95 opacity-100' : 'overlay-glass border-line-strong opacity-80'}`}
      onPointerDown={(e) => {
        e.preventDefault();
        set(true);
      }}
      onPointerUp={() => set(false)}
      onPointerLeave={() => set(false)}
      onPointerCancel={() => set(false)}
    >
      <div className="flex flex-col items-center gap-0.5">
        <Zap size={24} fill="currentColor" className="text-reward" />
        РЫВОК
      </div>
    </button>
  );
}

// ─── Results ────────────────────────────────────────────────────────────────

function Results({
  run,
  reward,
  levelName,
  onReplay,
  onMenu,
  onNext,
}: {
  run: RunResult;
  reward: RunReward;
  levelName?: string;
  onReplay: () => void;
  onMenu: () => void;
  onNext?: () => void;
}) {
  const score = useCountUp(run.score, 1);
  const coins = useCountUp(reward.coins, 1.2);
  const p = useProfile();

  let title = 'Игра окончена';
  let sprite = 'skull';
  let subtitle = '';
  switch (run.mode) {
    case 'campaign':
      if (run.win) {
        title = 'Уровень пройден!';
        sprite = 'trophy';
      } else {
        title = run.reason === 'rival' ? 'Соперник успел первым' : 'Не получилось';
        sprite = run.reason === 'rival' ? 'flag' : 'skull';
      }
      subtitle = levelName ?? '';
      break;
    case 'arena':
      title = run.win ? 'Победа на арене!' : run.reason === 'time' ? `Место #${run.rank}` : 'Тебя съели!';
      sprite = run.win ? 'crown' : run.reason === 'time' ? 'medal' : 'skull';
      break;
    case 'blitz':
      title = 'Время вышло!';
      sprite = 'stopwatch';
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

  const tiles: { sprite: string; label: string; value: string | number }[] =
    run.mode === 'duel'
      ? [
          { sprite: 'gamepad', label: 'Счёт', value: `${run.duelScore?.[0]} : ${run.duelScore?.[1]}` },
          { sprite: 'hourglass', label: 'Время', value: fmtTime(run.timeMs) },
        ]
      : [
          { sprite: 'snake', label: 'Длина', value: run.length },
          { sprite: 'apple', label: 'Фрукты', value: run.fruits },
          { sprite: 'fire', label: 'Комбо', value: run.maxCombo },
          run.mode === 'arena'
            ? { sprite: 'skull', label: 'Съедено', value: run.kills }
            : { sprite: 'hourglass', label: 'Время', value: fmtTime(run.timeMs) },
        ];

  const level = run.levelId ? LEVELS.find((l) => l.id === run.levelId) : undefined;

  return (
    <div className="p-6 text-center">
      <motion.div
        initial={{ scale: 0, rotate: -24 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 13 }}
      >
        <Emoji name={sprite} size={80} className="mx-auto animate-float" />
      </motion.div>
      <h2 className="font-display font-black text-3xl mt-2 leading-tight">{title}</h2>
      {subtitle && <p className="text-reward-soft font-semibold mt-1">{subtitle}</p>}

      {run.mode === 'campaign' && run.win && (
        <div className="flex justify-center mt-3">
          <Stars count={run.stars} size={40} animateIn />
        </div>
      )}
      {level && run.win && run.stars < 3 && (
        <p className="text-xs text-fg-mute mt-2">
          3 звезды — быстрее {levelPar(level)[1]} сек, 2 звезды — быстрее {levelPar(level)[0]} сек
        </p>
      )}

      {run.mode !== 'duel' && (
        <div className="mt-4">
          <div className="text-fg-mute text-xs uppercase tracking-widest font-bold">Очки</div>
          <div className="font-display font-black text-5xl tabular-nums">{score}</div>
          {run.mode === 'daily' && <div className="text-sm text-fg-soft mt-1">Цель испытания: {dailyChallenge().goalScore}</div>}
          {reward.newBest && run.mode !== 'campaign' && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.7, type: 'spring' }}
              className="inline-flex mt-2 items-center gap-1.5 rounded-full bg-reward/15 border border-reward/40 px-3 py-1 text-reward-soft text-sm font-bold"
            >
              <Emoji name="glowing_star" size={18} /> Рекорд! (был {reward.prevBest})
            </motion.div>
          )}
        </div>
      )}

      <div className={`grid gap-2 mt-4 ${tiles.length === 4 ? 'grid-cols-4' : 'grid-cols-2'}`}>
        {tiles.map((t) => (
          <StatTile key={t.label} sprite={t.sprite} label={t.label} value={t.value} spriteSize={22} />
        ))}
      </div>

      <div className="mt-4 rounded-card bg-reward/10 border border-reward/25 p-3">
        <div className="flex items-center justify-center gap-2 font-display font-black text-2xl text-reward-soft">
          +{coins} <Emoji name="coin" size={28} />
        </div>
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 mt-1 text-xs text-fg-soft">
          {reward.breakdown.map((b) => (
            <span key={b.label}>
              {b.label}: +{b.value}
            </span>
          ))}
          <span>Опыт: +{reward.xp}</span>
        </div>
        {reward.levelUp && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.9, type: 'spring' }}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent/15 border border-accent/40 px-3 py-1 text-accent-soft text-sm font-bold"
          >
            <Emoji name="sparkles" size={18} /> Новый уровень: {reward.levelUp}!
          </motion.div>
        )}
      </div>

      {reward.quests.length > 0 && (
        <div className="mt-3 grid gap-1.5">
          {reward.quests.map((id) => {
            const q = p.quests.list.find((x) => x.id === id);
            return (
              <div key={id} className="rounded-sm bg-accent/10 border border-accent/30 px-3 py-2 text-sm flex items-center gap-2">
                <Emoji name="check" size={20} />
                <span className="flex-1 text-left">Задание: {q ? questDef(id).text(q.target) : id}</span>
                <span className="text-accent-soft text-xs font-bold">забери награду</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid gap-3 mt-5">
        {onNext ? (
          <Button size="lg" full onClick={onNext}>
            Дальше <ChevronRight size={22} />
          </Button>
        ) : (
          <Button size="lg" full onClick={onReplay}>
            <RotateCcw size={20} /> Ещё раз
          </Button>
        )}
        <div className="grid grid-cols-2 gap-3">
          {onNext ? (
            <Button tone="info" full onClick={onReplay}>
              <RotateCcw size={18} /> Заново
            </Button>
          ) : (
            <div className="hidden" />
          )}
          <Button tone="neutral" full className={onNext ? '' : 'col-span-2'} onClick={onMenu}>
            <Home size={18} /> Меню
          </Button>
        </div>
      </div>
    </div>
  );
}
