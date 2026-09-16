import { useState, useEffect, useCallback, useRef } from 'react';
import { retroSounds } from './sounds';
import {
  SNAKE_HEAD_RIGHT, SNAKE_HEAD_LEFT, SNAKE_HEAD_UP, SNAKE_HEAD_DOWN,
  SNAKE_BODY, SNAKE_TAIL, FOOD_APPLE,
  drawSprite, drawCheckerboard, drawPixelBorder
} from './sprites';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };
type LevelKey = 'micro' | 'small' | 'classic' | 'large' | 'mega';
type GameState = 'menu' | 'playing' | 'paused' | 'gameover';

interface Level {
  key: LevelKey;
  label: string;
  gridSize: number;
  speed: number;
  description: string;
  stars: number;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
}

const LEVELS: Record<LevelKey, Level> = {
  micro: {
    key: 'micro',
    label: 'МИКРО',
    gridSize: 10,
    speed: 220,
    description: '10×10 · Огромные клетки',
    stars: 1,
    color: '#86c06c',
    bgColor: '#1a3a1a',
    borderColor: '#306850',
    icon: '🟢',
  },
  small: {
    key: 'small',
    label: 'МАЛЫШ',
    gridSize: 14,
    speed: 160,
    description: '14×14 · Большие клетки',
    stars: 2,
    color: '#a0d860',
    bgColor: '#2a4a1a',
    borderColor: '#508030',
    icon: '🟡',
  },
  classic: {
    key: 'classic',
    label: 'КЛАССИК',
    gridSize: 20,
    speed: 120,
    description: '20×20 · Стандарт',
    stars: 3,
    color: '#d4a017',
    bgColor: '#3a3a1a',
    borderColor: '#807020',
    icon: '🟠',
  },
  large: {
    key: 'large',
    label: 'МАСТЕР',
    gridSize: 28,
    speed: 85,
    description: '28×28 · Мелкие клетки',
    stars: 4,
    color: '#e07030',
    bgColor: '#3a2a1a',
    borderColor: '#804020',
    icon: '🔴',
  },
  mega: {
    key: 'mega',
    label: 'ЛЕГЕНДА',
    gridSize: 36,
    speed: 55,
    description: '36×36 · Крошечные клетки',
    stars: 5,
    color: '#e03050',
    bgColor: '#3a1a2a',
    borderColor: '#802040',
    icon: '💀',
  },
};

const LEVEL_LIST: Level[] = [
  LEVELS.micro,
  LEVELS.small,
  LEVELS.classic,
  LEVELS.large,
  LEVELS.mega,
];

function getRandomPosition(gridSize: number, snake: Position[]): Position {
  let pos: Position;
  do {
    pos = {
      x: Math.floor(Math.random() * gridSize),
      y: Math.floor(Math.random() * gridSize),
    };
  } while (snake.some(segment => segment.x === pos.x && segment.y === pos.y));
  return pos;
}

function App() {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [currentLevel, setCurrentLevel] = useState<LevelKey>('classic');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('snake-highscore-retro');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [snake, setSnake] = useState<Position[]>([
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ]);
  const [food, setFood] = useState<Position>({ x: 15, y: 15 });
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scoreFlash, setScoreFlash] = useState(false);
  const [isNewRecord, setIsNewRecord] = useState(false);

  const level = LEVELS[currentLevel];
  const gridSize = level.gridSize;

  const directionRef = useRef<Direction>('RIGHT');
  const gameLoopRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastDirectionRef = useRef<Direction>('RIGHT');
  const foodAnimFrame = useRef(0);

  // Sync sound
  useEffect(() => {
    retroSounds.setEnabled(soundEnabled);
  }, [soundEnabled]);

  // Initialize game
  const initGame = useCallback(() => {
    const mid = Math.floor(gridSize / 2);
    const initialSnake = [
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
    ];
    setSnake(initialSnake);
    setFood(getRandomPosition(gridSize, initialSnake));
    setScore(0);
    setIsNewRecord(false);
    setDirection('RIGHT');
    directionRef.current = 'RIGHT';
    lastDirectionRef.current = 'RIGHT';
  }, [gridSize]);

  // Start game
  const startGame = useCallback(() => {
    initGame();
    setGameState('playing');
    retroSounds.playStart();
  }, [initGame]);

  // Pause/Resume
  const togglePause = useCallback(() => {
    if (gameState === 'playing') {
      setGameState('paused');
      retroSounds.playPause();
    } else if (gameState === 'paused') {
      setGameState('playing');
    }
  }, [gameState]);

  // Game over
  const gameOver = useCallback(() => {
    setGameState('gameover');
    retroSounds.playGameOver();
    if (score > highScore) {
      setHighScore(score);
      setIsNewRecord(true);
      localStorage.setItem('snake-highscore-retro', score.toString());
      setTimeout(() => retroSounds.playHighScore(), 800);
    }
  }, [score, highScore]);

  // Draw game
  const drawGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const borderW = 6;
    const gameArea = canvas.width - borderW * 2;
    const cellSize = gameArea / gridSize;

    // Clear
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw checkerboard
    ctx.save();
    ctx.translate(borderW, borderW);
    drawCheckerboard(ctx, gameArea, gameArea, cellSize);

    // Draw food
    foodAnimFrame.current = (foodAnimFrame.current + 1) % 60;
    const foodPixelSize = Math.max(1, Math.floor(cellSize / 10));
    const foodOffset = Math.sin(foodAnimFrame.current * 0.1) * (cellSize > 20 ? 1 : 0);
    drawSprite(
      ctx,
      FOOD_APPLE,
      food.x * cellSize + (cellSize - foodPixelSize * 10) / 2,
      food.y * cellSize + (cellSize - foodPixelSize * 10) / 2 + foodOffset,
      foodPixelSize
    );

    // Draw snake
    const spritePixelSize = Math.max(1, Math.floor(cellSize / 10));

    snake.forEach((segment, index) => {
      const x = segment.x * cellSize;
      const y = segment.y * cellSize;
      const offsetX = (cellSize - spritePixelSize * 10) / 2;
      const offsetY = (cellSize - spritePixelSize * 10) / 2;

      if (index === 0) {
        let headSprite;
        switch (directionRef.current) {
          case 'LEFT': headSprite = SNAKE_HEAD_LEFT; break;
          case 'UP': headSprite = SNAKE_HEAD_UP; break;
          case 'DOWN': headSprite = SNAKE_HEAD_DOWN; break;
          default: headSprite = SNAKE_HEAD_RIGHT;
        }
        drawSprite(ctx, headSprite, x + offsetX, y + offsetY, spritePixelSize);
      } else if (index === snake.length - 1 && snake.length > 1) {
        drawSprite(ctx, SNAKE_TAIL, x + offsetX, y + offsetY, spritePixelSize);
      } else {
        drawSprite(ctx, SNAKE_BODY, x + offsetX, y + offsetY, spritePixelSize);
      }
    });

    ctx.restore();
    drawPixelBorder(ctx, canvas.width, canvas.height, borderW);
  }, [snake, food, gridSize]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      return;
    }

    const speed = level.speed;

    gameLoopRef.current = window.setInterval(() => {
      setSnake(prevSnake => {
        const head = { ...prevSnake[0] };
        const currentDir = directionRef.current;
        lastDirectionRef.current = currentDir;

        switch (currentDir) {
          case 'UP': head.y -= 1; break;
          case 'DOWN': head.y += 1; break;
          case 'LEFT': head.x -= 1; break;
          case 'RIGHT': head.x += 1; break;
        }

        if (head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize) {
          gameOver();
          return prevSnake;
        }

        if (prevSnake.some(segment => segment.x === head.x && segment.y === head.y)) {
          gameOver();
          return prevSnake;
        }

        const newSnake = [head, ...prevSnake];

        if (head.x === food.x && head.y === food.y) {
          setScore(prev => prev + 10);
          setFood(getRandomPosition(gridSize, newSnake));
          retroSounds.playEat();
          setScoreFlash(true);
          setTimeout(() => setScoreFlash(false), 300);
        } else {
          newSnake.pop();
        }

        return newSnake;
      });
    }, speed);

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    };
  }, [gameState, level.speed, food, gridSize, gameOver]);

  // Animation loop
  useEffect(() => {
    let animFrame: number;
    const animate = () => {
      drawGame();
      animFrame = requestAnimationFrame(animate);
    };
    animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, [drawGame]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'playing' || gameState === 'paused') {
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          togglePause();
          return;
        }
      }

      if (gameState === 'gameover' || gameState === 'menu') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startGame();
          return;
        }
      }

      if (gameState !== 'playing') return;

      const lastDir = lastDirectionRef.current;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          if (lastDir !== 'DOWN') { directionRef.current = 'UP'; setDirection('UP'); retroSounds.playTurn(); }
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          if (lastDir !== 'UP') { directionRef.current = 'DOWN'; setDirection('DOWN'); retroSounds.playTurn(); }
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          if (lastDir !== 'RIGHT') { directionRef.current = 'LEFT'; setDirection('LEFT'); retroSounds.playTurn(); }
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          if (lastDir !== 'LEFT') { directionRef.current = 'RIGHT'; setDirection('RIGHT'); retroSounds.playTurn(); }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, togglePause, startGame]);

  // Touch controls
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || gameState !== 'playing') return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const minSwipe = 30;

    if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) return;

    const lastDir = lastDirectionRef.current;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0 && lastDir !== 'LEFT') { directionRef.current = 'RIGHT'; setDirection('RIGHT'); retroSounds.playTurn(); }
      else if (dx < 0 && lastDir !== 'RIGHT') { directionRef.current = 'LEFT'; setDirection('LEFT'); retroSounds.playTurn(); }
    } else {
      if (dy > 0 && lastDir !== 'UP') { directionRef.current = 'DOWN'; setDirection('DOWN'); retroSounds.playTurn(); }
      else if (dy < 0 && lastDir !== 'DOWN') { directionRef.current = 'UP'; setDirection('UP'); retroSounds.playTurn(); }
    }

    touchStartRef.current = null;
  }, [gameState]);

  // Canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;

    const resize = () => {
      const maxSize = Math.min(container.clientWidth, 500);
      canvas.width = maxSize;
      canvas.height = maxSize;
      drawGame();
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [drawGame]);

  // Direction buttons
  const handleDirectionButton = (dir: Direction) => {
    if (gameState !== 'playing') return;
    const lastDir = lastDirectionRef.current;
    if (dir === 'UP' && lastDir !== 'DOWN') { directionRef.current = 'UP'; setDirection('UP'); retroSounds.playTurn(); }
    if (dir === 'DOWN' && lastDir !== 'UP') { directionRef.current = 'DOWN'; setDirection('DOWN'); retroSounds.playTurn(); }
    if (dir === 'LEFT' && lastDir !== 'RIGHT') { directionRef.current = 'LEFT'; setDirection('LEFT'); retroSounds.playTurn(); }
    if (dir === 'RIGHT' && lastDir !== 'LEFT') { directionRef.current = 'RIGHT'; setDirection('RIGHT'); retroSounds.playTurn(); }
  };

  // Render stars
  const renderStars = (count: number) => {
    return '★'.repeat(count) + '☆'.repeat(5 - count);
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex flex-col items-center justify-center p-3 overflow-hidden">
      {/* Title */}
      <div className="w-full max-w-[500px] mb-3">
        <h1 className="font-pixel text-center text-green-400 text-lg md:text-xl mb-3 tracking-wider">
          🐍 ЗМЕЙКА
        </h1>

        {/* Score panel */}
        <div className="flex justify-between items-center bg-[#1a1a2e] border-2 border-[#306850] rounded px-3 py-2">
          <div className="flex flex-col items-center">
            <span className="font-retro text-[#86c06c] text-xs">СЧЁТ</span>
            <span className={`font-pixel text-[#e0f8d0] text-sm ${scoreFlash ? 'animate-score-flash' : ''}`}>
              {score.toString().padStart(4, '0')}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-retro text-[#86c06c] text-xs">РЕКОРД</span>
            <span className="font-pixel text-[#d4a017] text-sm">
              {highScore.toString().padStart(4, '0')}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-retro text-[#86c06c] text-xs">ПОЛЕ</span>
            <span className="font-pixel text-[#e0f8d0] text-[10px]">
              {gridSize}×{gridSize}
            </span>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="font-retro text-lg text-[#86c06c] hover:text-[#e0f8d0] transition-colors"
            title={soundEnabled ? 'Выключить звук' : 'Включить звук'}
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>
        </div>
      </div>

      {/* Game canvas */}
      <div className="relative w-full max-w-[500px] game-area">
        <div className="crt-screen scanlines">
          <canvas
            ref={canvasRef}
            className="w-full bg-[#0a200a]"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          />
        </div>

        {/* Menu overlay */}
        {gameState === 'menu' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a1a]/95 animate-pixel-fade overflow-y-auto py-4">
            <div className="text-center w-full px-4">
              <div className="font-pixel text-[#86c06c] text-2xl mb-2 animate-bounce-retro">🐍</div>
              <h2 className="font-pixel text-[#e0f8d0] text-base md:text-lg mb-4">ВЫБОР УРОВНЯ</h2>

              {/* Level selection */}
              <div className="flex flex-col gap-2 mb-5 max-h-[280px] overflow-y-auto px-2">
                {LEVEL_LIST.map((lvl) => (
                  <button
                    key={lvl.key}
                    onClick={() => setCurrentLevel(lvl.key)}
                    className="flex items-center justify-between px-3 py-2 rounded transition-all text-left"
                    style={{
                      background: currentLevel === lvl.key ? lvl.bgColor : '#1a1a2e',
                      border: `2px solid ${currentLevel === lvl.key ? lvl.borderColor : '#2a2a4e'}`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{lvl.icon}</span>
                      <div>
                        <div
                          className="font-pixel text-[10px]"
                          style={{ color: currentLevel === lvl.key ? lvl.color : '#6a6a9e' }}
                        >
                          {lvl.label}
                        </div>
                        <div className="font-retro text-xs text-[#567c45]">
                          {lvl.description}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span
                        className="font-retro text-sm tracking-wider"
                        style={{ color: lvl.color }}
                      >
                        {renderStars(lvl.stars)}
                      </span>
                      <span className="font-retro text-[10px] text-[#567c45]">
                        {lvl.speed}мс
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={startGame}
                className="retro-btn retro-btn-green text-xs"
              >
                ▶ СТАРТ
              </button>

              <p className="font-retro text-[#567c45] text-sm mt-3">
                Стрелки / WASD / Свайпы
              </p>
              <p className="font-retro text-[#306850] text-xs mt-1 animate-blink">
                Нажмите ENTER чтобы начать
              </p>
            </div>
          </div>
        )}

        {/* Paused overlay */}
        {gameState === 'paused' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a1a]/90 animate-pixel-fade">
            <div className="text-center">
              <div className="font-pixel text-[#d4a017] text-lg mb-4">⏸ ПАУЗА</div>
              <div className="flex flex-col gap-3 items-center">
                <button
                  onClick={togglePause}
                  className="retro-btn retro-btn-green text-[10px]"
                >
                  ▶ ПРОДОЛЖИТЬ
                </button>
                <button
                  onClick={() => setGameState('menu')}
                  className="retro-btn retro-btn-gray text-[10px]"
                >
                  ↩ МЕНЮ
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Game over overlay */}
        {gameState === 'gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a1a]/95 animate-pixel-fade">
            <div className="text-center">
              <div className="font-pixel text-[#c03030] text-base mb-3">GAME OVER</div>
              <div className="font-retro text-[#e0f8d0] text-xl mb-1">
                СЧЁТ: <span className="text-[#86c06c]">{score}</span>
              </div>
              <div className="font-retro text-[#567c45] text-sm">
                Уровень: {level.label} ({gridSize}×{gridSize})
              </div>
              {isNewRecord && (
                <div className="font-pixel text-[#d4a017] text-[10px] mt-2 animate-bounce-retro">
                  ★ НОВЫЙ РЕКОРД! ★
                </div>
              )}
              <div className="flex flex-col gap-3 items-center mt-5">
                <button
                  onClick={startGame}
                  className="retro-btn retro-btn-green text-[10px]"
                >
                  ↻ ЕЩЁ РАЗ
                </button>
                <button
                  onClick={() => setGameState('menu')}
                  className="retro-btn retro-btn-gray text-[10px]"
                >
                  ↩ МЕНЮ
                </button>
              </div>
              <p className="font-retro text-[#306850] text-xs mt-4 animate-blink">
                Нажмите ENTER
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="w-full max-w-[500px] mt-3">
        {/* Action buttons */}
        <div className="flex justify-center gap-2 mb-3">
          {gameState === 'playing' && (
            <button
              onClick={togglePause}
              className="retro-btn retro-btn-gray text-[10px]"
            >
              ⏸ ПАУЗА
            </button>
          )}
          {(gameState === 'playing' || gameState === 'paused') && (
            <button
              onClick={() => { initGame(); setGameState('menu'); }}
              className="retro-btn retro-btn-red text-[10px]"
            >
              ↻ РЕСТАРТ
            </button>
          )}
        </div>

        {/* D-Pad for mobile */}
        <div className="flex flex-col items-center md:hidden">
          <button
            onTouchStart={(e) => { e.preventDefault(); handleDirectionButton('UP'); }}
            className="dpad-btn rounded-t-lg"
          >
            ▲
          </button>
          <div className="flex">
            <button
              onTouchStart={(e) => { e.preventDefault(); handleDirectionButton('LEFT'); }}
              className="dpad-btn rounded-bl-lg"
            >
              ◀
            </button>
            <div className="w-[56px] h-[56px] bg-[#1a1a2e] border-t-[3px] border-b-[3px] border-[#4a4a6e]" />
            <button
              onTouchStart={(e) => { e.preventDefault(); handleDirectionButton('RIGHT'); }}
              className="dpad-btn rounded-br-lg"
            >
              ▶
            </button>
          </div>
          <button
            onTouchStart={(e) => { e.preventDefault(); handleDirectionButton('DOWN'); }}
            className="dpad-btn rounded-b-lg"
          >
            ▼
          </button>
        </div>

        {/* Desktop hint */}
        <div className="hidden md:flex justify-center mt-1">
          <p className="font-retro text-[#306850] text-sm">
            ← ↑ ↓ → или W A S D • P/Esc — пауза
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 text-center">
        <p className="font-retro text-[#1a3a1a] text-xs">
          РЕТРО АРКАДА © 2025
        </p>
      </div>
    </div>
  );
}

export default App;
