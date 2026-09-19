import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { MUTATORS, POWER_LIST, SIZES, SPEEDS, mutatorById } from '../game/content';
import { danger, info, reward, special } from '../design/tokens';
import { classicMultiplier, dailyChallenge, type Launch } from '../game/launch';
import type { MutatorId } from '../game/types';
import { setProfile, useProfile } from '../store/profile';
import { Button, Chip, Emoji, Screen, Toggle, TopBar } from '../ui/kit';
import { useViewport } from '../ui/hooks';

/** Matches the daily mode card on the home screen. */
const DAILY_ACCENT = '#c9709e';

function Layout({ title, onBack, children, cta }: { title: string; onBack: () => void; children: ReactNode; cta: ReactNode }) {
  return (
    <Screen className="app-bg">
      <TopBar title={title} onBack={onBack} />
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="safe-x max-w-xl md:max-w-2xl mx-auto px-4 pb-32 grid gap-4">{children}</div>
      </div>
      <div className="absolute bottom-0 inset-x-0 safe-x px-4 pb-[max(var(--sab),14px)] pt-6 bg-gradient-to-t from-ink-950 via-ink-950/92 to-transparent">
        <div className="max-w-xl md:max-w-2xl mx-auto">{cta}</div>
      </div>
    </Screen>
  );
}

function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="glass rounded-panel p-4">
      <div className="flex items-center mb-3">
        <h2 className="font-display font-bold text-sm uppercase tracking-wider text-fg-soft flex-1">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

/** One identity colour, carried as a left rule and a faint wash. */
function Hero({ sprite, title, text, accent }: { sprite: string; title: string; text: ReactNode; accent: string }) {
  return (
    <div className="glass relative rounded-panel p-5 pl-6 flex gap-4 items-center overflow-hidden">
      <span className="absolute left-0 inset-y-0 w-[3px]" style={{ background: accent }} />
      <span
        className="absolute inset-0 pointer-events-none opacity-[0.12]"
        style={{ background: `radial-gradient(110% 120% at 0% 0%, ${accent}, transparent 62%)` }}
      />
      <Emoji name={sprite} size={64} className="animate-float relative" />
      <div className="relative">
        <div className="font-display font-black text-xl sm:text-2xl leading-tight">{title}</div>
        <div className="text-fg-soft text-sm mt-1 leading-snug">{text}</div>
      </div>
    </div>
  );
}

function Rule({ sprite, children }: { sprite: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <Emoji name={sprite} size={28} />
      <div className="text-sm text-fg-soft leading-snug pt-1">{children}</div>
    </div>
  );
}

function MutatorGrid({ selected, onToggle, readOnly }: { selected: MutatorId[]; onToggle?: (m: MutatorId) => void; readOnly?: boolean }) {
  const list = readOnly ? selected.map(mutatorById) : MUTATORS;
  return (
    <div className="grid grid-cols-2 gap-2">
      {list.map((m) => {
        const on = selected.includes(m.id);
        return (
          <motion.button
            key={m.id}
            whileTap={readOnly ? undefined : { scale: 0.95 }}
            onClick={() => onToggle?.(m.id)}
            className={`text-left rounded-card p-3 border transition ${on ? 'bg-accent/18 border-accent/60' : 'bg-white/[0.04] border-line-subtle'} ${readOnly ? 'cursor-default' : ''}`}
          >
            <div className="flex items-center gap-2">
              <Emoji name={m.sprite} size={30} />
              <span className="font-display font-bold text-sm flex-1 leading-tight">{m.name}</span>
              <span
                className={`text-[10px] font-black rounded-full px-1.5 py-0.5 ${m.bonus >= 0 ? 'bg-accent/25 text-accent-soft' : 'bg-danger/25 text-danger-soft'}`}
              >
                {m.bonus >= 0 ? '+' : ''}
                {Math.round(m.bonus * 100)}%
              </span>
            </div>
            <div className="text-[12px] text-fg-soft mt-1.5 leading-snug">{m.desc}</div>
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Classic / Mixer ─────────────────────────────────────────────────────────

export function ClassicSetup({ onBack, play }: { onBack: () => void; play: (l: Launch) => void }) {
  const p = useProfile();
  const s = p.classicSetup;
  const mult = classicMultiplier(s.speed, s.mutators);
  const update = (fn: (c: typeof s) => void) => setProfile((d) => fn(d.classicSetup));

  return (
    <Layout
      title="Миксер"
      onBack={onBack}
      cta={
        <Button size="lg" full onClick={() => play({ mode: 'classic' })}>
          ▶ Играть <span className="text-sm opacity-80 font-body font-bold">· очки ×{mult}</span>
        </Button>
      }
    >
      <Hero
        sprite="cyclone"
        title="Смешай правила"
        accent={info.base}
        text={
          <>
            Классическая змейка с любыми модификаторами — как «Блендер» в Google Snake. Сложнее правила — больше множитель очков. Рекорд:{' '}
            <b>{p.best.classic ?? 0}</b>
          </>
        }
      />

      <Section title="Скорость">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SPEEDS.map((sp) => (
            <Chip
              key={sp.id}
              active={s.speed === sp.id}
              onClick={() =>
                update((c) => {
                  c.speed = sp.id;
                })
              }
            >
              <Emoji name={sp.sprite} size={22} />
              {sp.name}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Размер поля">
        <div className="grid grid-cols-3 gap-2">
          {SIZES.map((sz) => (
            <Chip
              key={sz.id}
              active={s.size === sz.id}
              onClick={() =>
                update((c) => {
                  c.size = sz.id;
                })
              }
              className="justify-center flex-col !gap-0"
            >
              <span>{sz.name}</span>
              <span className="text-[11px] text-fg-mute">
                {sz.cols}×{sz.rows}
              </span>
            </Chip>
          ))}
        </div>
      </Section>

      <Section
        title="Бонусы на поле"
        right={
          <Toggle
            on={s.powerups}
            onChange={(v) =>
              update((c) => {
                c.powerups = v;
              })
            }
          />
        }
      >
        <div className="flex flex-wrap gap-2">
          {POWER_LIST.map((pw) => (
            <div
              key={pw.id}
              className={`flex items-center gap-1.5 rounded-full pl-1 pr-3 py-1 text-xs font-semibold ${s.powerups ? 'bg-white/[0.07]' : 'bg-white/[0.04] opacity-40'}`}
              title={pw.desc}
            >
              <Emoji name={pw.sprite} size={20} />
              {pw.name}
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Модификаторы"
        right={
          s.mutators.length ? (
            <button
              className="text-xs text-fg-soft underline"
              onClick={() =>
                update((c) => {
                  c.mutators = [];
                })
              }
            >
              сбросить
            </button>
          ) : undefined
        }
      >
        <MutatorGrid
          selected={s.mutators}
          onToggle={(m) =>
            update((c) => {
              c.mutators = c.mutators.includes(m) ? c.mutators.filter((x) => x !== m) : [...c.mutators, m];
            })
          }
        />
      </Section>
    </Layout>
  );
}

// ─── Arena ───────────────────────────────────────────────────────────────────

const BOT_LEVELS = [
  { level: 0, name: 'Новички', sprite: 'snail', desc: 'Часто ошибаются' },
  { level: 1, name: 'Опытные', sprite: 'robot', desc: 'Осторожные и быстрые' },
  { level: 2, name: 'Хищники', sprite: 'skull', desc: 'Охотятся на тебя' },
];

export function ArenaSetup({ onBack, play }: { onBack: () => void; play: (l: Launch) => void }) {
  const p = useProfile();
  const a = p.arenaSetup;
  const { coarse } = useViewport();
  return (
    <Layout
      title="Арена"
      onBack={onBack}
      cta={
        <Button size="lg" tone="danger" full onClick={() => play({ mode: 'arena' })}>
          ⚔️ В бой!
        </Button>
      }
    >
      <Hero
        sprite="swords"
        title="Змеиная битва"
        accent={danger.base}
        text={
          <>
            2 минуты на большой арене. Набери больше всех очков! Рекорд: <b>{p.best.arena ?? 0}</b>, побед: <b>{p.stats.arenaWins}</b>
          </>
        }
      />
      <Section title="Правила">
        <Rule sprite="skull">
          Если соперник врезается в твоё тело — он погибает и рассыпается <b>светящейся едой</b>. +100 очков!
        </Rule>
        <Rule sprite="collision">Лоб в лоб выигрывает более длинная змейка.</Rule>
        <Rule sprite="dashing">{coarse ? 'Кнопка «Рывок»' : 'Пробел'} — ускорение. Оно сжигает длину хвоста.</Rule>
        <Rule sprite="gift">На поле появляются бонусы: щит, магнит, призрак и другие.</Rule>
      </Section>
      <Section title="Соперники">
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <Chip
              key={n}
              active={a.bots === n}
              onClick={() =>
                setProfile((d) => {
                  d.arenaSetup.bots = n;
                })
              }
              className="justify-center font-display text-base"
            >
              {n}
            </Chip>
          ))}
        </div>
      </Section>
      <Section title="Характер ботов">
        <div className="grid grid-cols-3 gap-2">
          {BOT_LEVELS.map((b) => (
            <Chip
              key={b.level}
              active={a.level === b.level}
              onClick={() =>
                setProfile((d) => {
                  d.arenaSetup.level = b.level;
                })
              }
              className="flex-col !items-center text-center"
            >
              <Emoji name={b.sprite} size={32} />
              <span>{b.name}</span>
              <span className="text-[11px] text-fg-mute font-normal leading-tight">{b.desc}</span>
            </Chip>
          ))}
        </div>
      </Section>
    </Layout>
  );
}

// ─── Blitz ───────────────────────────────────────────────────────────────────

export function BlitzIntro({ onBack, play }: { onBack: () => void; play: (l: Launch) => void }) {
  const p = useProfile();
  return (
    <Layout
      title="Блиц"
      onBack={onBack}
      cta={
        <Button size="lg" tone="reward" full onClick={() => play({ mode: 'blitz' })}>
          ⚡ Старт — 60 секунд
        </Button>
      }
    >
      <Hero
        sprite="bolt"
        title="Минута безумия"
        accent={reward.base}
        text={
          <>
            Набери как можно больше очков за 60 секунд. Рекорд: <b>{p.best.blitz ?? 0}</b>
          </>
        }
      />
      <Section title="Правила">
        <Rule sprite="grapes">На поле всегда 3 фрукта, а границ нет — уползай за край.</Rule>
        <Rule sprite="stopwatch">
          Секундомер добавляет <b>+5 секунд</b>.
        </Rule>
        <Rule sprite="skull">
          Столкновение не заканчивает игру, но отнимает <b>10 секунд</b>.
        </Rule>
        <Rule sprite="fire">Держи комбо: каждые 3 фрукта подряд увеличивают множитель.</Rule>
      </Section>
    </Layout>
  );
}

// ─── Duel ────────────────────────────────────────────────────────────────────

export function DuelSetup({ onBack, play }: { onBack: () => void; play: (l: Launch) => void }) {
  const p = useProfile();
  const d = p.duelSetup;
  const { coarse } = useViewport();
  return (
    <Layout
      title="Дуэль"
      onBack={onBack}
      cta={
        <Button size="lg" tone="special" full onClick={() => play({ mode: 'duel' })}>
          🎮 Начать матч
        </Button>
      }
    >
      <Hero sprite="gamepad" title="Один на один" accent={special.base} text="Позови друга: последний выживший забирает раунд." />
      {coarse && (
        <div className="rounded-card bg-reward/15 border border-reward/40 p-3 text-sm flex gap-2 items-center">
          <Emoji name="keyboard" size={28} /> Для дуэли нужна клавиатура.
        </div>
      )}
      <Section title="Управление">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-card bg-accent/10 border border-accent/30 p-3 text-center">
            <div className="font-display font-bold text-accent-soft">Игрок 1</div>
            <Keys keys={['W', 'A', 'S', 'D']} />
          </div>
          <div className="rounded-card bg-reward/10 border border-reward/30 p-3 text-center">
            <div className="font-display font-bold text-reward">Игрок 2</div>
            <Keys keys={['↑', '←', '↓', '→']} />
          </div>
        </div>
      </Section>
      <Section title="До скольких побед">
        <div className="grid grid-cols-3 gap-2">
          {[2, 3, 5].map((n) => (
            <Chip
              key={n}
              active={d.rounds === n}
              onClick={() =>
                setProfile((x) => {
                  x.duelSetup.rounds = n;
                })
              }
              className="justify-center font-display"
            >
              {n}
            </Chip>
          ))}
        </div>
      </Section>
      <Section title="Скорость">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SPEEDS.map((sp) => (
            <Chip
              key={sp.id}
              active={d.speed === sp.id}
              onClick={() =>
                setProfile((x) => {
                  x.duelSetup.speed = sp.id;
                })
              }
            >
              <Emoji name={sp.sprite} size={22} />
              {sp.name}
            </Chip>
          ))}
        </div>
      </Section>
    </Layout>
  );
}

function Keys({ keys }: { keys: string[] }) {
  const k = 'w-9 h-9 rounded-lg bg-ink-600 border-b-4 border-black/40 grid place-items-center font-display font-bold';
  return (
    <div className="grid grid-cols-3 gap-1 w-fit mx-auto mt-2">
      <span className={`${k} col-start-2`}>{keys[0]}</span>
      <span className={`${k} col-start-1`}>{keys[1]}</span>
      <span className={k}>{keys[2]}</span>
      <span className={k}>{keys[3]}</span>
    </div>
  );
}

// ─── Daily ───────────────────────────────────────────────────────────────────

export function DailyIntro({ onBack, play }: { onBack: () => void; play: (l: Launch) => void }) {
  const p = useProfile();
  const d = dailyChallenge();
  const date = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const speed = SPEEDS.find((s) => s.id === d.speed)!;
  return (
    <Layout
      title="Испытание дня"
      onBack={onBack}
      cta={
        <Button size="lg" tone="special" full onClick={() => play({ mode: 'daily' })}>
          🎯 Принять вызов
        </Button>
      }
    >
      <Hero
        sprite="calendar"
        title={date}
        accent={DAILY_ACCENT}
        text="Одинаковые правила и одинаковое поле для всех на весь день. Завтра — новое испытание!"
      />
      <div className="grid grid-cols-3 gap-2">
        <Stat sprite="bullseye" label="Цель" value={d.goalScore} />
        <Stat sprite="trophy" label="Лучший" value={p.daily.best} />
        <Stat sprite="coin" label="Награда" value={p.daily.rewarded ? '✓' : 150} />
      </div>
      <Section title="Сегодняшние правила">
        <MutatorGrid selected={d.mutators} readOnly />
        <div className="flex gap-2 mt-3 text-sm text-fg-soft">
          <span className="glass rounded-full pl-1 pr-3 py-1 flex items-center gap-1.5">
            <Emoji name={speed.sprite} size={20} />
            {speed.name}
          </span>
          <span className="glass rounded-full px-3 py-1">Очки ×{d.mult}</span>
          <span className="glass rounded-full pl-1 pr-3 py-1 flex items-center gap-1.5">
            <Emoji name="gift" size={20} />
            Бонусы
          </span>
        </div>
      </Section>
    </Layout>
  );
}

function Stat({ sprite, label, value }: { sprite: string; label: string; value: ReactNode }) {
  return (
    <div className="glass rounded-card p-3 text-center">
      <Emoji name={sprite} size={28} className="mx-auto" />
      <div className="font-display font-black text-lg mt-1 tabular-nums">{value}</div>
      <div className="text-[10px] uppercase font-bold text-fg-mute tracking-wider">{label}</div>
    </div>
  );
}
