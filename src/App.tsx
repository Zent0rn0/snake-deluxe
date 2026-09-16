import { useState, useEffect, useCallback, useRef } from 'react';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };
type Difficulty = 'easy' | 'medium' | 'hard';
type GameState = 'menu' | 'playing' | 'paused' | 'gameover';

const GRID_SIZE = 20;
const DIFFICULTY_SPEEDS: Record<Difficulty, number> = {
  easy: 150,
  medium: 100,
  hard: 60,
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Легко',
  medium: 'Средне',
  hard: 'Сложно',
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: 'from-green-500 to-emerald-600',
  medium: 'from-yellow-500 to-orange-600',
  hard: 'from-red-500 to-rose-600',
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
    const saved = localStorage.getItem('snake-highscore');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Position>({ x: 15, y: 15 });
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [showScorePopup, setShowScorePopup] = useState(false);

  const directionRef = useRef<Direction>('RIGHT');
  const gameLoopRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastDirectionRef = useRef<Direction>('RIGHT');

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
    setDirection('RIGHT');
    directionRef.current = 'RIGHT';
    lastDirectionRef.current = 'RIGHT';
  }, []);

  // Start game
  const startGame = useCallback(() => {
    initGame();
    setGameState('playing');
  }, [initGame]);

  // Pause/Resume
  const togglePause = useCallback(() => {
    if (gameState === 'playing') {
      setGameState('paused');
    } else if (gameState === 'paused') {
      setGameState('playing');
    }
  }, [gameState]);

  // Game over
  const gameOver = useCallback(() => {
    setGameState('gameover');
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('snake-highscore', score.toString());
    }
  }, [score, highScore]);

  // Draw game on canvas
  const drawGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cellSize = canvas.width / GRID_SIZE;

    // Clear canvas
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(canvas.width, i * cellSize);
      ctx.stroke();
    }

    // Draw food with glow effect
    const foodX = food.x * cellSize + cellSize / 2;
    const foodY = food.y * cellSize + cellSize / 2;
    const foodRadius = cellSize * 0.4;

    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(foodX, foodY, foodRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.shadowBlur = 0;

    // Inner food highlight
    ctx.beginPath();
    ctx.arc(foodX - foodRadius * 0.2, foodY - foodRadius * 0.2, foodRadius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fill();

    // Draw snake
    snake.forEach((segment, index) => {
      const x = segment.x * cellSize;
      const y = segment.y * cellSize;
      const padding = 1;

      if (index === 0) {
        // Head
        ctx.shadowColor = '#4ade80';
        ctx.shadowBlur = 8;
        const gradient = ctx.createLinearGradient(x, y, x + cellSize, y + cellSize);
        gradient.addColorStop(0, '#4ade80');
        gradient.addColorStop(1, '#22c55e');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, 4);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Eyes
        const eyeSize = cellSize * 0.12;
        ctx.fillStyle = '#0f172a';
        let eye1X: number, eye1Y: number, eye2X: number, eye2Y: number;

        switch (directionRef.current) {
          case 'RIGHT':
            eye1X = x + cellSize * 0.7; eye1Y = y + cellSize * 0.3;
            eye2X = x + cellSize * 0.7; eye2Y = y + cellSize * 0.7;
            break;
          case 'LEFT':
            eye1X = x + cellSize * 0.3; eye1Y = y + cellSize * 0.3;
            eye2X = x + cellSize * 0.3; eye2Y = y + cellSize * 0.7;
            break;
          case 'UP':
            eye1X = x + cellSize * 0.3; eye1Y = y + cellSize * 0.3;
            eye2X = x + cellSize * 0.7; eye2Y = y + cellSize * 0.3;
            break;
          case 'DOWN':
            eye1X = x + cellSize * 0.3; eye1Y = y + cellSize * 0.7;
            eye2X = x + cellSize * 0.7; eye2Y = y + cellSize * 0.7;
            break;
        }
        ctx.beginPath();
        ctx.arc(eye1X, eye1Y, eyeSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(eye2X, eye2Y, eyeSize, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Body segments with gradient
        const alpha = 1 - (index / snake.length) * 0.4;
        ctx.fillStyle = `rgba(74, 222, 128, ${alpha})`;
        ctx.beginPath();
        ctx.roundRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, 3);
        ctx.fill();
      }
    });
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

        // Check wall collision
        if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
          gameOver();
          return prevSnake;
        }

        // Check self collision
        if (prevSnake.some(segment => segment.x === head.x && segment.y === head.y)) {
          gameOver();
          return prevSnake;
        }

        const newSnake = [head, ...prevSnake];

        // Check food collision
        if (head.x === food.x && head.y === food.y) {
          setScore(prev => prev + 10);
          setFood(getRandomPosition(GRID_SIZE, newSnake));
          setShowScorePopup(true);
          setTimeout(() => setShowScorePopup(false), 500);
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

  // Draw on every state change
  useEffect(() => {
    drawGame();
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
          if (lastDir !== 'DOWN') { directionRef.current = 'UP'; setDirection('UP'); }
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          if (lastDir !== 'UP') { directionRef.current = 'DOWN'; setDirection('DOWN'); }
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          if (lastDir !== 'RIGHT') { directionRef.current = 'LEFT'; setDirection('LEFT'); }
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          if (lastDir !== 'LEFT') { directionRef.current = 'RIGHT'; setDirection('RIGHT'); }
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
      if (dx > 0 && lastDir !== 'LEFT') { directionRef.current = 'RIGHT'; setDirection('RIGHT'); }
      else if (dx < 0 && lastDir !== 'RIGHT') { directionRef.current = 'LEFT'; setDirection('LEFT'); }
    } else {
      if (dy > 0 && lastDir !== 'UP') { directionRef.current = 'DOWN'; setDirection('DOWN'); }
      else if (dy < 0 && lastDir !== 'DOWN') { directionRef.current = 'UP'; setDirection('UP'); }
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
      const size = Math.min(container.clientWidth, container.clientHeight, 500);
      canvas.width = size;
      canvas.height = size;
      drawGame();
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [drawGame]);

  // Direction buttons for mobile
  const handleDirectionButton = (dir: Direction) => {
    if (gameState !== 'playing') return;
    const lastDir = lastDirectionRef.current;
    if (dir === 'UP' && lastDir !== 'DOWN') { directionRef.current = 'UP'; setDirection('UP'); }
    if (dir === 'DOWN' && lastDir !== 'UP') { directionRef.current = 'DOWN'; setDirection('DOWN'); }
    if (dir === 'LEFT' && lastDir !== 'RIGHT') { directionRef.current = 'LEFT'; setDirection('LEFT'); }
    if (dir === 'RIGHT' && lastDir !== 'LEFT') { directionRef.current = 'RIGHT'; setDirection('RIGHT'); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Header */}
      <div className="w-full max-w-lg mb-4">
        <h1 className="text-3xl md:text-4xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500 mb-2">
          🐍 Змейка
        </h1>

        {/* Score bar */}
        <div className="flex justify-between items-center bg-slate-800/80 backdrop-blur-sm rounded-xl px-4 py-2 border border-slate-700/50">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">Счёт:</span>
            <span className={`text-xl font-bold text-green-400 transition-transform ${showScorePopup ? 'scale-125' : 'scale-100'}`}>
              {score}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">Рекорд:</span>
            <span className="text-xl font-bold text-yellow-400">
              {highScore}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">Сложность:</span>
            <span className={`text-sm font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r ${DIFFICULTY_COLORS[difficulty]} text-white`}>
              {DIFFICULTY_LABELS[difficulty]}
            </span>
          </div>
        </div>
      </div>

      {/* Game area */}
      <div className="relative w-full max-w-lg aspect-square game-area">
        <canvas
          ref={canvasRef}
          className="w-full h-full rounded-xl border-2 border-slate-700/50 shadow-2xl shadow-green-500/10"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        />

        {/* Menu overlay */}
        {gameState === 'menu' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-sm rounded-xl animate-fadeIn">
            <div className="text-6xl mb-4">🐍</div>
            <h2 className="text-2xl font-bold text-white mb-6">Змейка</h2>

            {/* Difficulty selection */}
            <div className="mb-6">
              <p className="text-slate-400 text-sm text-center mb-3">Выберите сложность:</p>
              <div className="flex gap-3">
                {(['easy', 'medium', 'hard'] as Difficulty[]).map((diff) => (
                  <button
                    key={diff}
                    onClick={() => setDifficulty(diff)}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
                      difficulty === diff
                        ? `bg-gradient-to-r ${DIFFICULTY_COLORS[diff]} text-white scale-105 shadow-lg`
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {DIFFICULTY_LABELS[diff]}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={startGame}
              className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl text-lg hover:scale-105 transition-transform shadow-lg shadow-green-500/30 active:scale-95"
            >
              Начать игру
            </button>

            <p className="text-slate-500 text-xs mt-4 text-center px-4">
              Управление: стрелки / WASD / свайпы
            </p>
          </div>
        )}

        {/* Paused overlay */}
        {gameState === 'paused' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm rounded-xl animate-fadeIn">
            <div className="text-5xl mb-4">⏸️</div>
            <h2 className="text-2xl font-bold text-white mb-4">Пауза</h2>
            <div className="flex gap-3">
              <button
                onClick={togglePause}
                className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:scale-105 transition-transform shadow-lg"
              >
                Продолжить
              </button>
              <button
                onClick={() => { setGameState('menu'); }}
                className="px-6 py-2 bg-slate-700 text-slate-300 font-bold rounded-xl hover:bg-slate-600 transition-colors"
              >
                Меню
              </button>
            </div>
          </div>
        )}

        {/* Game over overlay */}
        {gameState === 'gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-sm rounded-xl animate-fadeIn">
            <div className="text-5xl mb-3">💀</div>
            <h2 className="text-2xl font-bold text-red-400 mb-2">Игра окончена!</h2>
            <p className="text-slate-300 mb-1">Ваш счёт: <span className="text-green-400 font-bold text-xl">{score}</span></p>
            {score >= highScore && score > 0 && (
              <p className="text-yellow-400 text-sm font-semibold animate-slideUp mb-3">
                🏆 Новый рекорд!
              </p>
            )}
            <div className="flex gap-3 mt-3">
              <button
                onClick={startGame}
                className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:scale-105 transition-transform shadow-lg"
              >
                Заново
              </button>
              <button
                onClick={() => setGameState('menu')}
                className="px-6 py-2 bg-slate-700 text-slate-300 font-bold rounded-xl hover:bg-slate-600 transition-colors"
              >
                Меню
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="w-full max-w-lg mt-4">
        {/* Action buttons */}
        <div className="flex justify-center gap-3 mb-4">
          {gameState === 'playing' && (
            <button
              onClick={togglePause}
              className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg font-medium hover:bg-slate-600 transition-colors flex items-center gap-2"
            >
              <span>⏸</span> Пауза
            </button>
          )}
          {(gameState === 'playing' || gameState === 'paused') && (
            <button
              onClick={() => setGameState('menu')}
              className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg font-medium hover:bg-slate-600 transition-colors flex items-center gap-2"
            >
              <span>🔄</span> Рестарт
            </button>
          )}
        </div>

        {/* D-Pad for mobile */}
        <div className="flex flex-col items-center md:hidden">
          <button
            onTouchStart={(e) => { e.preventDefault(); handleDirectionButton('UP'); }}
            className="w-14 h-14 bg-slate-700/80 rounded-xl flex items-center justify-center text-2xl text-white active:bg-green-600 transition-colors mb-1 shadow-lg border border-slate-600/50"
          >
            ▲
          </button>
          <div className="flex gap-1">
            <button
              onTouchStart={(e) => { e.preventDefault(); handleDirectionButton('LEFT'); }}
              className="w-14 h-14 bg-slate-700/80 rounded-xl flex items-center justify-center text-2xl text-white active:bg-green-600 transition-colors shadow-lg border border-slate-600/50"
            >
              ◀
            </button>
            <div className="w-14 h-14" />
            <button
              onTouchStart={(e) => { e.preventDefault(); handleDirectionButton('RIGHT'); }}
              className="w-14 h-14 bg-slate-700/80 rounded-xl flex items-center justify-center text-2xl text-white active:bg-green-600 transition-colors shadow-lg border border-slate-600/50"
            >
              ▶
            </button>
          </div>
          <button
            onTouchStart={(e) => { e.preventDefault(); handleDirectionButton('DOWN'); }}
            className="w-14 h-14 bg-slate-700/80 rounded-xl flex items-center justify-center text-2xl text-white active:bg-green-600 transition-colors mt-1 shadow-lg border border-slate-600/50"
          >
            ▼
          </button>
        </div>

        {/* Desktop hint */}
        <div className="hidden md:flex justify-center mt-2">
          <p className="text-slate-500 text-xs">
            ← ↑ ↓ → или W A S D для управления • P или Esc — пауза
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
