import { AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { audio } from './audio/audio';
import { preload } from './game/assets';
import type { Launch } from './game/launch';
import { Campaign } from './screens/Campaign';
import { GameScreen } from './screens/GameScreen';
import { Home } from './screens/Home';
import { Achievements, SettingsScreen, Stats } from './screens/Meta';
import { Rewards } from './screens/Rewards';
import { ArenaSetup, BlitzIntro, ClassicSetup, DailyIntro, DuelSetup } from './screens/Setup';
import { Shop } from './screens/Shop';
import { getProfile, refreshDaily } from './store/profile';
import { Toasts } from './ui/toasts';

export type Route =
  | 'home' | 'campaign' | 'arena' | 'blitz' | 'classic' | 'duel' | 'daily'
  | 'shop' | 'rewards' | 'achievements' | 'stats' | 'settings';

export default function App() {
  const [route, setRoute] = useState<Route>('home');
  const [game, setGame] = useState<{ launch: Launch; key: number; from: Route } | null>(null);

  useEffect(() => {
    refreshDaily();
    const s = getProfile().settings;
    audio.sfxOn = s.sfx;
    audio.musicOn = s.music;
    audio.setVolume(s.volume);
    audio.setTrack('menu');
    void preload(['snake', 'coin', 'star', 'map', 'swords', 'bolt', 'cyclone', 'gamepad', 'calendar', 'bags', 'gift', 'trophy', 'medal']);

    // Browsers only allow audio after a user gesture.
    const unlock = () => {
      audio.unlock();
      audio.startMusic();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    const onFocus = () => refreshDaily();
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const go = useCallback((r: Route) => {
    audio.play('whoosh', { volume: 0.6 });
    setRoute(r);
  }, []);

  const play = useCallback((launch: Launch) => {
    audio.unlock();
    setGame((g) => ({ launch, key: (g?.key ?? 0) + 1, from: g?.from ?? route }));
  }, [route]);

  const exitGame = useCallback(() => {
    if (game) setRoute(game.launch.mode === 'campaign' ? 'campaign' : game.from);
    setGame(null);
    refreshDaily();
  }, [game]);

  const back = () => go('home');

  let screen;
  if (game) {
    screen = <GameScreen key={`game-${game.key}`} launch={game.launch} onExit={exitGame} onRelaunch={play} />;
  } else {
    switch (route) {
      case 'campaign': screen = <Campaign key="campaign" onBack={back} play={play} />; break;
      case 'arena': screen = <ArenaSetup key="arena" onBack={back} play={play} />; break;
      case 'blitz': screen = <BlitzIntro key="blitz" onBack={back} play={play} />; break;
      case 'classic': screen = <ClassicSetup key="classic" onBack={back} play={play} />; break;
      case 'duel': screen = <DuelSetup key="duel" onBack={back} play={play} />; break;
      case 'daily': screen = <DailyIntro key="daily" onBack={back} play={play} />; break;
      case 'shop': screen = <Shop key="shop" onBack={back} />; break;
      case 'rewards': screen = <Rewards key="rewards" onBack={back} />; break;
      case 'achievements': screen = <Achievements key="achievements" onBack={back} />; break;
      case 'stats': screen = <Stats key="stats" onBack={back} />; break;
      case 'settings': screen = <SettingsScreen key="settings" onBack={back} />; break;
      default: screen = <Home key="home" go={go} play={play} />;
    }
  }

  return (
    <div className="fixed inset-0 overflow-hidden app-bg text-white">
      <AnimatePresence mode="wait">{screen}</AnimatePresence>
      <Toasts />
    </div>
  );
}
