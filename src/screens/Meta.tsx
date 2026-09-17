import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { audio } from '../audio/audio';
import { MUTATORS, POWER_LIST } from '../game/content';
import { ACHIEVEMENTS, levelInfo, resetProfile, setProfile, useProfile, type Settings as SettingsT } from '../store/profile';
import { Button, Chip, Emoji, Modal, ProgressBar, Screen, Toggle, TopBar } from '../ui/kit';

// ─── Achievements ───────────────────────────────────────────────────────────

export function Achievements({ onBack }: { onBack: () => void }) {
  const p = useProfile();
  const done = ACHIEVEMENTS.filter((a) => p.achievements[a.id]).length;
  const lvl = levelInfo(p.xp);
  const sorted = [...ACHIEVEMENTS].sort((a, b) => Number(!!p.achievements[b.id]) - Number(!!p.achievements[a.id]));
  return (
    <Screen className="app-bg">
      <TopBar title="Трофеи" onBack={onBack} />
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="max-w-xl mx-auto px-4 pb-10">
          <div className="glass rounded-3xl p-4 flex items-center gap-4">
            <div className="relative">
              <Emoji name="trophy" size={64} />
            </div>
            <div className="flex-1">
              <div className="font-display font-black text-2xl">{done} / {ACHIEVEMENTS.length}</div>
              <ProgressBar value={done} max={ACHIEVEMENTS.length} color="#facc15" className="mt-2" />
              <div className="text-xs text-white/60 mt-2">Уровень игрока {lvl.level} · до следующего {lvl.need - lvl.into} опыта</div>
            </div>
          </div>
          <div className="grid gap-2.5 mt-4">
            {sorted.map((a, i) => {
              const got = !!p.achievements[a.id];
              const prog = a.progress?.(p);
              return (
                <motion.div key={a.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                  className={`rounded-2xl p-3 flex items-center gap-3 border ${got ? 'bg-gradient-to-r from-amber-400/15 to-transparent border-amber-300/30' : 'bg-white/5 border-white/10'}`}>
                  <div className={`w-14 h-14 rounded-2xl grid place-items-center ${got ? 'bg-amber-300/20' : 'bg-black/20'}`}>
                    <Emoji name={a.sprite} size={40} style={got ? undefined : { filter: 'grayscale(1)', opacity: 0.45 }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold leading-tight">{a.name}</div>
                    <div className="text-xs text-white/60 mt-0.5">{a.desc}</div>
                    {!got && prog && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <ProgressBar value={prog[0]} max={prog[1]} className="flex-1 h-1.5" />
                        <span className="text-[10px] text-white/50 tabular-nums">{Math.min(prog[0], prog[1])}/{prog[1]}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    {got ? <Check className="text-emerald-300 ml-auto" size={22} /> : (
                      <div className="flex items-center gap-1 text-amber-200 font-display font-bold text-sm">+{a.reward}<Emoji name="coin" size={18} /></div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </Screen>
  );
}

// ─── Records / stats ────────────────────────────────────────────────────────

const RECORD_MODES = [
  { id: 'classic', name: 'Миксер', sprite: 'cyclone' },
  { id: 'blitz', name: 'Блиц', sprite: 'bolt' },
  { id: 'arena', name: 'Арена', sprite: 'swords' },
  { id: 'daily', name: 'Испытания', sprite: 'calendar' },
];

export function Stats({ onBack }: { onBack: () => void }) {
  const p = useProfile();
  const [tab, setTab] = useState('classic');
  const hist = p.history[tab] ?? [];
  const s = p.stats;
  const minutes = Math.round(s.playTimeMs / 60000);
  const tiles: [string, string, ReactNode][] = [
    ['gamepad', 'Игр сыграно', s.games],
    ['apple', 'Фруктов съедено', s.fruits],
    ['hourglass', 'Минут в игре', minutes],
    ['fire', 'Лучшее комбо', s.maxCombo],
    ['snake', 'Макс. длина', s.maxLength],
    ['skull', 'Съедено змей', s.kills],
    ['dizzy', 'Телепортаций', s.portals],
    ['coin', 'Монет заработано', s.coinsEarned],
    ['crown', 'Побед на арене', s.arenaWins],
  ];
  return (
    <Screen className="app-bg">
      <TopBar title="Рекорды" onBack={onBack} />
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="max-w-xl mx-auto px-4 pb-10 grid gap-4">
          <div className="grid grid-cols-4 gap-2">
            {RECORD_MODES.map((m) => (
              <button key={m.id} onClick={() => { audio.play('click'); setTab(m.id); }}
                className={`rounded-2xl p-2 text-center border transition ${tab === m.id ? 'bg-white/15 border-white/40' : 'glass border-transparent'}`}>
                <Emoji name={m.sprite} size={30} className="mx-auto" />
                <div className="text-[11px] font-bold mt-1">{m.name}</div>
                <div className="font-display font-black text-sm tabular-nums text-amber-200">{m.id === 'daily' ? p.daily.best : p.best[m.id] ?? 0}</div>
              </button>
            ))}
          </div>
          <section className="glass rounded-3xl p-4">
            <h2 className="font-display font-bold text-sm uppercase tracking-wider text-white/70 mb-2">Лучшие результаты</h2>
            {hist.length === 0 ? (
              <div className="text-center text-white/50 py-6 text-sm">Пока пусто — сыграй, чтобы попасть в таблицу!</div>
            ) : (
              <div className="grid gap-1">
                {hist.map((h, i) => (
                  <div key={i} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${i < 3 ? 'bg-white/8' : ''}`}>
                    <span className="w-7 text-center">{i < 3 ? <Emoji name={['medal1', 'medal2', 'medal3'][i]} size={24} /> : <span className="text-white/50 font-bold">{i + 1}</span>}</span>
                    <span className="flex-1 text-sm text-white/60">{new Date(h.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="font-display font-black tabular-nums">{h.score}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="grid grid-cols-3 gap-2">
            {tiles.map(([sprite, label, value]) => (
              <div key={label} className="glass rounded-2xl p-3 text-center">
                <Emoji name={sprite} size={28} className="mx-auto" />
                <div className="font-display font-black text-lg mt-1 tabular-nums">{value}</div>
                <div className="text-[10px] uppercase font-bold text-white/50 leading-tight">{label}</div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </Screen>
  );
}

// ─── Settings ───────────────────────────────────────────────────────────────

function Row({ sprite, label, hint, children }: { sprite: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Emoji name={sprite} size={30} />
      <div className="flex-1">
        <div className="font-semibold">{label}</div>
        {hint && <div className="text-xs text-white/50">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Legend({ sprite, title, children }: { sprite: string; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-2">
      <Emoji name={sprite} size={34} />
      <div>
        <div className="font-display font-bold text-sm">{title}</div>
        <div className="text-xs text-white/60 leading-snug">{children}</div>
      </div>
    </div>
  );
}

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const p = useProfile();
  const [confirm, setConfirm] = useState(false);
  const set = <K extends keyof SettingsT>(key: K, value: SettingsT[K]) => setProfile((d) => { d.settings[key] = value; });

  return (
    <Screen className="app-bg">
      <TopBar title="Настройки" onBack={onBack} />
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="max-w-xl mx-auto px-4 pb-10 grid gap-4">
          <section className="glass rounded-3xl px-4 py-2 divide-y divide-white/10">
            <Row sprite="party" label="Звуковые эффекты">
              <Toggle on={p.settings.sfx} onChange={(v) => { set('sfx', v); audio.sfxOn = v; }} />
            </Row>
            <Row sprite="headphone" label="Музыка">
              <Toggle on={p.settings.music} onChange={(v) => { set('music', v); audio.setMusic(v); }} />
            </Row>
            <Row sprite="bolt" label="Громкость">
              <input type="range" min={0} max={1} step={0.05} value={p.settings.volume}
                onChange={(e) => { const v = Number(e.target.value); set('volume', v); audio.setVolume(v); }}
                className="w-32 accent-emerald-400" />
            </Row>
            <Row sprite="collision" label="Вибрация" hint="На телефонах">
              <Toggle on={p.settings.vibration} onChange={(v) => set('vibration', v)} />
            </Row>
            <Row sprite="snake" label="Звук поворота">
              <Toggle on={p.settings.turnSound} onChange={(v) => set('turnSound', v)} />
            </Row>
            <Row sprite="sparkles" label="Меньше эффектов" hint="Без тряски экрана и конфетти">
              <Toggle on={p.settings.reducedFx} onChange={(v) => set('reducedFx', v)} />
            </Row>
            <div className="py-3">
              <div className="flex items-center gap-3 mb-2"><Emoji name="joystick" size={30} /><span className="font-semibold">Экранный джойстик</span></div>
              <div className="grid grid-cols-3 gap-2">
                {([['auto', 'Авто'], ['on', 'Всегда'], ['off', 'Свайпы']] as const).map(([id, label]) => (
                  <Chip key={id} active={p.settings.dpad === id} onClick={() => set('dpad', id)} className="justify-center">{label}</Chip>
                ))}
              </div>
            </div>
          </section>

          <section className="glass rounded-3xl p-4">
            <h2 className="font-display font-black text-lg mb-1">Как играть</h2>
            <Legend sprite="apple" title="Фрукты">+10 очков и +1 к длине. Ешь подряд без пауз — растёт комбо-множитель (×2 за каждые 3 фрукта).</Legend>
            <Legend sprite="glowing_star" title="Золотое яблоко">+50 очков, но исчезает через несколько секунд.</Legend>
            <Legend sprite="coin" title="Монетки">Копятся в кошельке — трать их в магазине.</Legend>
            {POWER_LIST.map((pw) => (
              <Legend key={pw.id} sprite={pw.sprite} title={pw.name}>{pw.desc}</Legend>
            ))}
            <Legend sprite="dashing" title="Рывок">Пробел или кнопка «Рывок» — ускорение и ×1.5 к очкам. На арене сжигает хвост.</Legend>
            <div className="h-px bg-white/10 my-2" />
            <div className="text-xs uppercase tracking-wider text-white/50 font-bold mb-1">Модификаторы</div>
            {MUTATORS.map((m) => (
              <Legend key={m.id} sprite={m.sprite} title={m.name}>{m.desc}</Legend>
            ))}
          </section>

          <section className="glass rounded-3xl p-4 text-xs text-white/55 leading-relaxed">
            <div className="font-display font-bold text-sm text-white/80 mb-1">Авторы ресурсов</div>
            3D-иконки — Microsoft Fluent Emoji (MIT). Звуки — ZzFX by Frank Force (MIT). Шрифты Unbounded и Rubik — Google Fonts (OFL).
          </section>

          <Button tone="red" onClick={() => setConfirm(true)}>Сбросить прогресс</Button>
        </div>
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)}>
        <div className="p-6 text-center">
          <Emoji name="bomb" size={80} className="mx-auto" />
          <div className="font-display font-black text-2xl mt-2">Точно сбросить?</div>
          <p className="text-white/60 mt-1">Монеты, покупки, звёзды и достижения пропадут навсегда.</p>
          <div className="grid grid-cols-2 gap-3 mt-6">
            <Button tone="slate" onClick={() => setConfirm(false)}>Отмена</Button>
            <Button tone="red" onClick={() => { resetProfile(); setConfirm(false); }}>Сбросить</Button>
          </div>
        </div>
      </Modal>
    </Screen>
  );
}
