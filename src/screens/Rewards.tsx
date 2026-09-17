import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
import { useRef, useState } from 'react';
import { audio } from '../audio/audio';
import { emojiUrl } from '../game/assets';
import { SPIN_PRICE, WHEEL, canSpinFree, claimQuest, questDef, spinWheel, useProfile, type WheelPrize } from '../store/profile';
import { Button, Emoji, Modal, ProgressBar, Screen, TopBar } from '../ui/kit';
import { toastAchievements } from '../ui/toasts';

const SEG = 360 / WHEEL.length;

function polar(r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [150 + r * Math.cos(a), 150 + r * Math.sin(a)];
}

function Wheel({ rotation }: { rotation: number }) {
  return (
    <div className="relative w-[300px] h-[300px] mx-auto">
      <div className="absolute inset-[-10px] rounded-full bg-gradient-to-b from-amber-300 to-orange-600 shadow-[0_20px_50px_-10px_rgba(0,0,0,.7)]" />
      <div className="absolute inset-[-4px] rounded-full bg-ink-900" />
      <motion.svg
        viewBox="0 0 300 300"
        className="absolute inset-0"
        animate={{ rotate: rotation }}
        transition={{ duration: 4.2, ease: [0.12, 0.8, 0.2, 1] }}
      >
        {WHEEL.map((w, i) => {
          const [x1, y1] = polar(148, i * SEG);
          const [x2, y2] = polar(148, (i + 1) * SEG);
          const [tx, ty] = polar(98, i * SEG + SEG / 2);
          const [lx, ly] = polar(58, i * SEG + SEG / 2);
          return (
            <g key={i}>
              <path d={`M150 150 L${x1} ${y1} A148 148 0 0 1 ${x2} ${y2} Z`} fill={w.color} stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
              <path d={`M150 150 L${x1} ${y1} A148 148 0 0 1 ${x2} ${y2} Z`} fill="url(#gloss)" />
              <g transform={`rotate(${i * SEG + SEG / 2} ${tx} ${ty})`}>
                <image href={emojiUrl(w.sprite)} x={tx - 18} y={ty - 20} width="36" height="36" />
              </g>
              <text x={lx} y={ly} transform={`rotate(${i * SEG + SEG / 2} ${lx} ${ly})`} textAnchor="middle" dominantBaseline="middle"
                fontFamily="Unbounded, sans-serif" fontWeight="800" fontSize={w.label.length > 3 ? 12 : 15} fill="white" stroke="rgba(0,0,0,.35)" strokeWidth="3" paintOrder="stroke">
                {w.label}
              </text>
            </g>
          );
        })}
        <defs>
          <radialGradient id="gloss" cx="50%" cy="30%" r="70%">
            <stop offset="0" stopColor="white" stopOpacity="0.25" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>
        {Array.from({ length: WHEEL.length }, (_, i) => {
          const [x, y] = polar(141, i * SEG);
          return <circle key={i} cx={x} cy={y} r="4" fill="#fef3c7" />;
        })}
      </motion.svg>
      <div className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-gradient-to-b from-amber-200 to-amber-500 border-4 border-ink-900 grid place-items-center shadow-lg">
        <Emoji name="snake" size={38} />
      </div>
      <div className="absolute left-1/2 -top-5 -translate-x-1/2 w-0 h-0 border-l-[16px] border-r-[16px] border-t-[30px] border-l-transparent border-r-transparent border-t-rose-500 drop-shadow-[0_4px_4px_rgba(0,0,0,.5)]" />
    </div>
  );
}

export function Rewards({ onBack }: { onBack: () => void }) {
  const p = useProfile();
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [prize, setPrize] = useState<{ prize: WheelPrize; itemName?: string } | null>(null);
  const tickTimer = useRef<number | null>(null);
  const free = canSpinFree(p);

  const spin = () => {
    if (spinning) return;
    const r = spinWheel();
    if (!r) return;
    setSpinning(true);
    const center = r.index * SEG + SEG / 2;
    const target = rotation - (rotation % 360) + 360 * 6 + (360 - center) + (Math.random() - 0.5) * SEG * 0.6;
    setRotation(target);

    // Ticks that slow down with the wheel.
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 4200;
      if (t >= 1) return;
      audio.play('tick', { rate: 1 + (1 - t) * 0.3 });
      tickTimer.current = window.setTimeout(tick, 40 + t * t * 320);
    };
    tick();

    window.setTimeout(() => {
      setSpinning(false);
      setPrize({ prize: r.prize, itemName: r.itemName });
      audio.win();
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.45 }, zIndex: 70 });
      toastAchievements(r.achievements);
    }, 4400);
  };

  const hoursLeft = () => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(24, 0, 0, 0);
    const h = Math.floor((end.getTime() - now.getTime()) / 3600000);
    const m = Math.floor(((end.getTime() - now.getTime()) % 3600000) / 60000);
    return `${h} ч ${m} мин`;
  };

  return (
    <Screen className="app-bg">
      <TopBar title="Награды" onBack={onBack} />
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="max-w-xl mx-auto px-4 pb-10 grid gap-4">
          <section className="glass rounded-3xl p-5 pt-8 overflow-hidden relative">
            <div className="absolute -top-20 -left-20 w-60 h-60 rounded-full bg-amber-400/20 blur-3xl animate-blob" />
            <div className="absolute -bottom-20 -right-20 w-60 h-60 rounded-full bg-pink-500/20 blur-3xl animate-blob" />
            <h2 className="relative font-display font-black text-2xl text-center mb-7">Колесо удачи</h2>
            <Wheel rotation={rotation} />
            <div className="relative mt-7">
              {free ? (
                <Button size="lg" tone="gold" full disabled={spinning} className="shine" onClick={spin}>🎡 Крутить бесплатно</Button>
              ) : (
                <Button size="lg" tone="purple" full disabled={spinning || p.coins < SPIN_PRICE} onClick={spin}>
                  Крутить за <Emoji name="coin" size={24} /> {SPIN_PRICE}
                </Button>
              )}
              {!free && <p className="text-center text-xs text-white/50 mt-2">Бесплатное вращение через {hoursLeft()}</p>}
            </div>
          </section>

          <section className="glass rounded-3xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Emoji name="bullseye" size={30} />
              <h2 className="font-display font-black text-lg flex-1">Задания дня</h2>
              <span className="text-xs text-white/50">обновятся через {hoursLeft()}</span>
            </div>
            <div className="grid gap-2.5">
              {p.quests.list.map((q, i) => {
                const def = questDef(q.id);
                const done = q.progress >= q.target;
                return (
                  <div key={q.id} className={`rounded-2xl p-3 flex items-center gap-3 border ${q.claimed ? 'bg-white/5 border-white/5 opacity-60' : done ? 'bg-amber-400/15 border-amber-300/40' : 'bg-white/5 border-white/10'}`}>
                    <Emoji name={def.sprite} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm leading-tight">{def.text(q.target)}</div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <ProgressBar value={q.progress} max={q.target} className="flex-1" color={done ? '#facc15' : '#4ade80'} />
                        <span className="text-xs tabular-nums text-white/60 w-14 text-right">{Math.min(q.progress, q.target)}/{q.target}</span>
                      </div>
                    </div>
                    {q.claimed ? (
                      <span className="text-emerald-300 text-xs font-bold w-20 text-center">Получено</span>
                    ) : (
                      <Button size="sm" tone={done ? 'gold' : 'slate'} disabled={!done} className={done ? 'animate-wiggle' : ''}
                        onClick={() => { const got = claimQuest(i); if (got) { audio.play('coin'); confetti({ particleCount: 40, spread: 50, origin: { y: 0.7 }, zIndex: 70 }); } }}>
                        <Emoji name="coin" size={18} />{q.reward}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <Modal open={!!prize} onClose={() => setPrize(null)}>
        {prize && (
          <div className="p-7 text-center">
            <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 12 }}>
              <Emoji name={prize.prize.sprite} size={110} className="mx-auto" />
            </motion.div>
            <div className="font-display font-black text-3xl mt-3">
              {prize.prize.item ? 'Подарок!' : `+${prize.prize.coins} монет`}
            </div>
            {prize.itemName && <p className="text-amber-200 font-semibold mt-1">{prize.itemName}</p>}
            <div className="mt-6"><Button size="lg" full onClick={() => setPrize(null)}>Забрать</Button></div>
          </div>
        )}
      </Modal>
    </Screen>
  );
}
