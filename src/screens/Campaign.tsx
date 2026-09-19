import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { audio } from '../audio/audio';
import { accent, ink, neutral, reward } from '../design/tokens';
import { mutatorById } from '../game/content';
import type { Launch } from '../game/launch';
import { LEVELS, levelPar, type LevelDef } from '../game/levels';
import { useProfile } from '../store/profile';
import { Button, Emoji, Modal, Screen, Stars, TopBar } from '../ui/kit';

function features(level: LevelDef) {
  const list: { sprite: string; label: string }[] = [];
  const map = level.map.join('');
  if (/[ABC]/i.test(map)) list.push({ sprite: 'dizzy', label: 'Порталы' });
  if (map.includes('K')) list.push({ sprite: 'key', label: 'Ключ и замки' });
  if (map.includes('G')) list.push({ sprite: 'coin', label: 'Монеты' });
  if (level.wrap) list.push({ sprite: 'cyclone', label: 'Без границ' });
  if (level.rival) list.push({ sprite: 'flag', label: 'Соперник' });
  if (level.powerups) list.push({ sprite: 'gift', label: 'Бонусы' });
  for (const m of level.mutators ?? []) list.push({ sprite: mutatorById(m).sprite, label: mutatorById(m).name });
  return list;
}

export function Campaign({ onBack, play }: { onBack: () => void; play: (l: Launch) => void }) {
  const p = useProfile();
  const [open, setOpen] = useState<LevelDef | null>(null);
  const currentRef = useRef<HTMLDivElement>(null);
  const totalStars = Object.values(p.campaign).reduce((a, b) => a + b, 0);
  const unlocked = (l: LevelDef) => l.id === 1 || (p.campaign[l.id - 1] ?? 0) > 0;
  const current = LEVELS.find((l) => unlocked(l) && !(p.campaign[l.id] > 0));

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);

  return (
    <Screen className="app-bg">
      <TopBar
        title="Приключение"
        onBack={onBack}
        right={
          <div className="glass rounded-full pl-1.5 pr-4 py-1.5 flex items-center gap-2 font-display font-bold">
            <Emoji name="star" size={24} /> {totalStars}/{LEVELS.length * 3}
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="relative safe-x max-w-md mx-auto px-4 pt-4 pb-24">
          {/* Path line */}
          <svg
            className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none"
            width={400}
            height={LEVELS.length * 124}
            viewBox={`0 0 400 ${LEVELS.length * 124}`}
            aria-hidden
          >
            <path
              d={LEVELS.map((_, i) => `${i ? 'L' : 'M'} ${200 + Math.sin(i * 1.1) * 90} ${62 + i * 124}`).join(' ')}
              fill="none"
              stroke="rgba(255,255,255,0.09)"
              strokeWidth={10}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="2 18"
            />
          </svg>
          {LEVELS.map((level, i) => {
            const isUnlocked = unlocked(level);
            const stars = p.campaign[level.id] ?? 0;
            const offset = Math.sin(i * 1.1) * 90;
            const isCurrent = current?.id === level.id;
            return (
              <div key={level.id} ref={isCurrent ? currentRef : undefined} className="relative h-[124px] flex items-center justify-center">
                <motion.button
                  initial={{ scale: 0.6, opacity: 0, x: offset }}
                  animate={{ scale: 1, opacity: 1, x: offset }}
                  transition={{ delay: Math.min(i, 8) * 0.04, type: 'spring', stiffness: 260, damping: 18 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => {
                    audio.play('click');
                    if (isUnlocked) setOpen(level);
                  }}
                  className="relative flex flex-col items-center"
                >
                  {isCurrent && (
                    <motion.div
                      className="absolute -top-9 whitespace-nowrap rounded-sm bg-fg text-ink-950 font-display font-black text-xs px-3 py-1.5 shadow-e2"
                      animate={{ y: [0, -5, 0] }}
                      transition={{ repeat: Infinity, duration: 1.4 }}
                    >
                      ИГРАТЬ
                      <span className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2.5 h-2.5 bg-fg rotate-45" />
                    </motion.div>
                  )}
                  <div
                    className={`w-[78px] h-[78px] rounded-full grid place-items-center relative ${isCurrent ? 'pulse-ring' : ''}`}
                    style={{
                      background: isUnlocked
                        ? stars > 0
                          ? `linear-gradient(180deg, ${reward.soft}, ${reward.base})`
                          : `linear-gradient(180deg, ${accent.soft}, ${accent.base})`
                        : `linear-gradient(180deg, ${neutral.base}, ${neutral.deep})`,
                      boxShadow: `0 6px 0 ${isUnlocked ? (stars > 0 ? reward.deep : accent.deep) : ink[950]}, 0 12px 22px -10px rgba(0,0,0,.65)`,
                    }}
                  >
                    {isUnlocked ? <Emoji name={level.sprite} size={46} /> : <Lock size={30} className="text-fg-soft" />}
                    <span className="absolute -left-1 -top-1 w-7 h-7 rounded-full bg-ink-900 ring-2 ring-line-strong grid place-items-center font-display font-black text-xs">
                      {level.id}
                    </span>
                  </div>
                  <div className="mt-2.5 h-6">{isUnlocked && <Stars count={stars} size={18} />}</div>
                </motion.button>
              </div>
            );
          })}
          <div className="text-center mt-4">
            <Emoji
              name="trophy"
              size={64}
              className={`mx-auto ${totalStars === LEVELS.length * 3 ? 'animate-float' : 'grayscale opacity-50'}`}
            />
            <div className="text-sm text-fg-soft mt-2">Собери все {LEVELS.length * 3} звёзд</div>
          </div>
        </div>
      </div>

      <Modal open={!!open} onClose={() => setOpen(null)}>
        {open && (
          <div className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-panel bg-accent/15 border border-accent/30 grid place-items-center">
                <Emoji name={open.sprite} size={56} />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-accent-soft">Уровень {open.id}</div>
                <div className="font-display font-black text-2xl leading-tight">{open.name}</div>
                <div className="mt-1">
                  <Stars count={p.campaign[open.id] ?? 0} size={20} />
                </div>
              </div>
            </div>
            <p className="mt-4 text-fg-soft leading-snug">{open.tip}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="glass rounded-full pl-1 pr-3 py-1 text-sm flex items-center gap-1.5 font-semibold">
                <Emoji name="apple" size={20} />
                Съесть {open.goal}
              </span>
              {features(open).map((f) => (
                <span key={f.label} className="glass rounded-full pl-1 pr-3 py-1 text-sm flex items-center gap-1.5">
                  <Emoji name={f.sprite} size={20} />
                  {f.label}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs">
              {[
                ['Пройти', 1],
                [`≤ ${levelPar(open)[0]} сек`, 2],
                [`≤ ${levelPar(open)[1]} сек`, 3],
              ].map(([label, n]) => (
                <div key={n} className="rounded-card bg-white/[0.04] border border-line py-2">
                  <div className="flex justify-center">
                    <Stars count={n as number} max={n as number} size={14} />
                  </div>
                  <div className="mt-1 font-semibold text-fg-soft">{label}</div>
                </div>
              ))}
            </div>
            <div className="mt-5">
              <Button size="lg" full onClick={() => play({ mode: 'campaign', levelId: open.id })}>
                ▶ Играть
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Screen>
  );
}
