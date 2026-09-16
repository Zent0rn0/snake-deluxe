import { useState, useEffect, useCallback, useRef } from 'react';
import { retroSounds } from './sounds';
import {
  SNAKE_HEAD_RIGHT, SNAKE_HEAD_LEFT, SNAKE_HEAD_UP, SNAKE_HEAD_DOWN,
  SNAKE_BODY, SNAKE_TAIL, FOOD_APPLE,
  drawSprite, drawCheckerboard, drawPixelBorder
} from './sprites';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };
type Difficulty = 'easy' | 'medium' | 'hard';
type GameState = 'menu' | 'playing' | 'paused' | 'gameover';

const GRID_SIZE = 20;
const DIFFICULTY_SPEEDS: Record<Difficulty, number> = {
  easy: 180,
  medium: 120,
  hard: 70,
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Легко',
  medium: 'Средне',
  hard: 'Сложно',
};

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
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
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

  const directionRef = useRef<Direction>('RIGHT');
  const gameLoopRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastDirectionRef = useRef<Direction>('RIGHT');
  const foodAnimFrame = useRef(0);

  // Sync sound setting
  useEffect(() => {
    retroSounds.setEnabled(soundEnabled);
  }, [soundEnabled]);

  // Initialize game
  const initGame = useCallback(() => {
    const initialSnake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    setSnake(initialSnake);
    setFood(getRandomPosition(GRID_SIZE, initialSnake));
    setScore(0);
    setIsNewRecord(false);
    setDirection('RIGHT');
    directionRef.current = 'RIGHT';
    lastDirectionRef.current = 'RIGHT';
  }, []);

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
    const cellSize = gameArea / GRID_SIZE;

    // Clear
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw checkerboard background
    ctx.save();
    ctx.translate(borderW, borderW);
    drawCheckerboard(ctx, gameArea, gameArea, cellSize);

    // Draw food with animation
    foodAnimFrame.current = (foodAnimFrame.current + 1) % 60;
    const foodPixelSize = cellSize / 10;
    const foodOffset = Math.sin(foodAnimFrame.current * 0.1) * 1;
    drawSprite(
      ctx,
      FOOD_APPLE,
      food.x * cellSize + (cellSize - foodPixelSize * 10) / 2,
      food.y * cellSize + (cellSize - foodPixelSize * 10) / 2 + foodOffset,
      foodPixelSize
    );

    // Draw snake
    const spritePixelSize = cellSize / 10;

    snake.forEach((segment, index) => {
      const x = segment.x * cellSize;
      const y = segment.y * cellSize;
      const offsetX = (cellSize - spritePixelSize * 10) / 2;
      const offsetY = (cellSize - spritePixelSize * 10) / 2;

      if (index === 0) {
        // Head
        let headSprite;
        switch (directionRef.current) {
          case 'LEFT': headSprite = SNAKE_HEAD_LEFT; break;
          case 'UP': headSprite = SNAKE_HEAD_UP; break;
          case 'DOWN': headSprite = SNAKE_HEAD_DOWN; break;
          default: headSprite = SNAKE_HEAD_RIGHT;
        }
        drawSprite(ctx, headSprite, x + offsetX, y + offsetY, spritePixelSize);
      } else if (index === snake.length - 1 && snake.length > 1) {
        // Tail
        drawSprite(ctx, SNAKE_TAIL, x + offsetX, y + offsetY, spritePixelSize);
      } else {
        // Body
        drawSprite(ctx, SNAKE_BODY, x + offsetX, y + offsetY, spritePixelSize);
      }
    });

    ctx.restore();

    // Draw border
    drawPixelBorder(ctx, canvas.width, canvas.height, borderW);
  }, [snake, food]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      return;
    }

    const speed = DIFFICULTY_SPEEDS[difficulty];

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

        // Wall collision
        if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
          gameOver();
          return prevSnake;
        }

        // Self collision
        if (prevSnake.some(segment => segment.x === head.x && segment.y === head.y)) {
          gameOver();
          return prevSnake;
        }

        const newSnake = [head, ...prevSnake];

        // Food collision
        if (head.x === food.x && head.y === food.y) {
          setScore(prev => prev + 10);
          setFood(getRandomPosition(GRID_SIZE, newSnake));
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
  }, [gameState, difficulty, food, gameOver]);

  // Animation loop for food
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
            <span className="font-retro text-[#86c06c] text-xs">УРОВЕНЬ</span>
            <span className="font-pixel text-[#e0f8d0] text-[10px]">
              {DIFFICULTY_LABELS[difficulty]}
            </span>
          </div>
          {/* Sound toggle */}
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
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a1a]/95 animate-pixel-fade">
            <div className="text-center">
              <div className="font-pixel text-[#86c06c] text-2xl mb-2 animate-bounce-retro">🐍</div>
              <h2 className="font-pixel text-[#e0f8d0] text-base md:text-lg mb-6">ЗМЕЙКА</h2>

              {/* Difficulty */}
              <div className="mb-6">
                <p className="font-retro text-[#86c06c] text-lg mb-3">ВЫБЕРИТЕ УРОВЕНЬ:</p>
                <div className="flex gap-2 justify-center">
                  {(['easy', 'medium', 'hard'] as Difficulty[]).map((diff) => (
                    <button
                      key={diff}
                      onClick={() => setDifficulty(diff)}
                      className={`retro-btn text-[10px] ${
                        difficulty === diff ? 'retro-btn-green' : 'retro-btn-gray'
                      }`}
                    >
                      {DIFFICULTY_LABELS[diff]}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={startGame}
                className="retro-btn retro-btn-green text-xs"
              >
                ▶ СТАРТ
              </button>

              <p className="font-retro text-[#567c45] text-sm mt-4">
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
            <div className="w-[56px] h-[56px] bg-[#1a1a2e] border-t-3 border-b-3 border-[#4a4a6e]" />
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
