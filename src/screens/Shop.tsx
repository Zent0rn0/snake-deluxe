import { motion } from 'framer-motion';
import { Check, Lock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { audio } from '../audio/audio';
import { preload } from '../game/assets';
import { HATS, RARITY, SKINS, THEMES, type Rarity } from '../game/content';
import { drawPreviewSnake, roundRect } from '../game/renderer';
import { buy, equip, useProfile, type ShopKind } from '../store/profile';
import { Button, Emoji, Screen, TopBar } from '../ui/kit';
import { pushToast, toastAchievements } from '../ui/toasts';

function SnakePreview({ skin, hat, theme, height = 150 }: { skin: string; hat: string; theme?: { tileA: string; tileB: string }; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let raf = 0;
    void preload(HATS.map((h) => h.sprite).filter(Boolean));
    const draw = (now: number) => {
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (c.width !== Math.round(w * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (theme) {
        const cs = h / 5;
        ctx.save();
        roundRect(ctx, 0, 0, w, h, 18);
        ctx.clip();
        for (let y = 0; y < 6; y++) for (let x = 0; x < Math.ceil(w / cs); x++) {
          ctx.fillStyle = (x + y) % 2 ? theme.tileA : theme.tileB;
          ctx.fillRect(x * cs, y * cs, cs + 1, cs + 1);
        }
        ctx.restore();
      }
      drawPreviewSnake(ctx, w, h, skin, hat, now / 1000);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [skin, hat, theme]);
  return <canvas ref={ref} className="w-full block" style={{ height }} />;
}

interface Entry {
  id: string;
  name: string;
  price: number;
  rarity: Rarity;
  visual: React.ReactNode;
}

export function Shop({ onBack }: { onBack: () => void }) {
  const p = useProfile();
  const [tab, setTab] = useState<ShopKind>('skins');
  const [selected, setSelected] = useState<string>(p.equipped.skin);

  useEffect(() => {
    setSelected(tab === 'skins' ? p.equipped.skin : tab === 'hats' ? p.equipped.hat : p.equipped.theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const entries: Entry[] =
    tab === 'skins'
      ? SKINS.map((s) => ({
        id: s.id, name: s.name, price: s.price, rarity: s.rarity,
        visual: <div className="w-14 h-14 rounded-full border-4 shadow-inner" style={{ background: `linear-gradient(135deg, ${s.preview[0]}, ${s.preview[1]})`, borderColor: s.outline }} />,
      }))
      : tab === 'hats'
        ? HATS.map((h) => ({
          id: h.id, name: h.name, price: h.price, rarity: h.rarity,
          visual: h.sprite ? <Emoji name={h.sprite} size={54} /> : <div className="w-14 h-14 rounded-full border-2 border-dashed border-white/30 grid place-items-center text-white/40 text-2xl">∅</div>,
        }))
        : THEMES.map((t) => ({
          id: t.id, name: t.name, price: t.price, rarity: t.rarity,
          visual: (
            <div className="w-14 h-14 rounded-2xl grid grid-cols-3 grid-rows-3 overflow-hidden border-4 relative" style={{ borderColor: t.frame }}>
              {Array.from({ length: 9 }, (_, i) => <span key={i} style={{ background: i % 2 ? t.tileA : t.tileB }} />)}
              <Emoji name={t.icon} size={30} className="absolute inset-0 m-auto" />
            </div>
          ),
        }));

  const sel = entries.find((e) => e.id === selected) ?? entries[0];
  const owned = p.owned[tab].includes(sel.id);
  const equipped = (tab === 'skins' ? p.equipped.skin : tab === 'hats' ? p.equipped.hat : p.equipped.theme) === sel.id;
  const previewSkin = tab === 'skins' ? sel.id : p.equipped.skin;
  const previewHat = tab === 'hats' ? sel.id : p.equipped.hat;
  const previewTheme = THEMES.find((t) => t.id === (tab === 'themes' ? sel.id : p.equipped.theme))!;

  const doBuy = () => {
    const r = buy(tab, sel.id);
    if (r.ok) {
      audio.play('buy');
      pushToast({ sprite: 'bags', title: 'Покупка', text: `«${sel.name}» теперь твоё!` });
      toastAchievements(r.achievements);
    }
  };

  return (
    <Screen className="app-bg">
      <TopBar title="Магазин" onBack={onBack} />
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="max-w-xl mx-auto px-4 pb-10">
          {/* Preview */}
          <div className="glass rounded-3xl p-3">
            <div className="rounded-2xl overflow-hidden" style={{ background: previewTheme.frame }}>
              <div className="p-2">
                <SnakePreview skin={previewSkin} hat={previewHat} theme={previewTheme} />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-3 px-1">
              <div className="flex-1 min-w-0">
                <div className="font-display font-black text-xl truncate">{sel.name}</div>
                <div className="text-xs font-bold uppercase tracking-wider" style={{ color: RARITY[sel.rarity].color }}>{RARITY[sel.rarity].label}</div>
              </div>
              {owned ? (
                equipped ? (
                  <div className="rounded-2xl px-4 py-3 bg-emerald-400/20 text-emerald-200 font-display font-bold flex items-center gap-2"><Check size={18} /> Надето</div>
                ) : (
                  <Button tone="blue" onClick={() => equip(tab, sel.id)}>Надеть</Button>
                )
              ) : (
                <Button tone="gold" disabled={p.coins < sel.price} onClick={doBuy}>
                  <Emoji name="coin" size={22} /> {sel.price}
                </Button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-3 gap-2 mt-4 glass rounded-2xl p-1.5">
            {([['skins', 'Скины', 'artist'], ['hats', 'Шляпы', 'tophat'], ['themes', 'Арены', 'clover']] as const).map(([id, label, sprite]) => (
              <button
                key={id}
                onClick={() => { audio.play('click'); setTab(id); }}
                className={`rounded-xl py-2 flex items-center justify-center gap-2 font-display font-bold text-sm transition ${tab === id ? 'bg-white/20 shadow' : 'text-white/60'}`}
              >
                <Emoji name={sprite === 'artist' ? 'sparkles' : sprite} size={22} /> {label}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 mt-4">
            {entries.map((e, i) => {
              const isOwned = p.owned[tab].includes(e.id);
              const isSel = e.id === sel.id;
              return (
                <motion.button
                  key={`${tab}-${e.id}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => { audio.play('click'); setSelected(e.id); }}
                  className={`relative rounded-2xl p-2.5 pt-3 flex flex-col items-center border-2 transition ${isSel ? 'bg-white/15' : 'bg-white/5 border-transparent'}`}
                  style={{ borderColor: isSel ? RARITY[e.rarity].color : undefined }}
                >
                  <span className="absolute top-0 inset-x-3 h-1 rounded-b-full" style={{ background: RARITY[e.rarity].color }} />
                  {e.visual}
                  <div className="text-xs font-bold mt-2 truncate w-full text-center">{e.name}</div>
                  <div className="text-[11px] mt-0.5 h-4 flex items-center gap-1 font-semibold">
                    {isOwned ? <span className="text-emerald-300 flex items-center gap-0.5"><Check size={12} />есть</span> : (
                      <span className={`flex items-center gap-0.5 ${p.coins >= e.price ? 'text-amber-200' : 'text-white/40'}`}>
                        {p.coins < e.price && <Lock size={10} />}{e.price}
                      </span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
          <p className="text-center text-xs text-white/40 mt-6">Монеты даются за игры, задания, достижения и колесо удачи</p>
        </div>
      </div>
    </Screen>
  );
}
