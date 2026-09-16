import { useState, useEffect, useCallback, useRef } from 'react';
import { retroSounds } from './sounds';
import {
  SNAKE_HEAD_RIGHT, SNAKE_HEAD_LEFT, SNAKE_HEAD_UP, SNAKE_HEAD_DOWN,
  SNAKE_BODY, SNAKE_TAIL, FOOD_APPLE,
  drawSprite, drawCheckerboard, drawPixelBorder
} from './sprites';
import { ParticleSystem, ScreenShake, BloomEffect, lerp, smoothstep } from './effects';

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
    speed: 150,
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
    speed: 110,
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
    speed: 80,
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
    speed: 55,
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
    speed: 35,
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

// Interpolated position for smooth rendering
interface InterpolatedSegment {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
}

function App() {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [currentLevel, setCurrentLevel] = useState<LevelKey>('classic');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('snake-highscore-retro');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scoreFlash, setScoreFlash] = useState(false);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [fps, setFps] = useState(0);
  const [showFps, setShowFps] = useState(false);

  const level = LEVELS[currentLevel];
  const gridSize = level.gridSize;

  // Game state in refs for performance (no re-renders)
  const snakeRef = useRef<Position[]>([]);
  const foodRef = useRef<Position>({ x: 15, y: 15 });
  const directionRef = useRef<Direction>('RIGHT');
  const lastDirectionRef = useRef<Direction>('RIGHT');
  const interpolatedSnakeRef = useRef<InterpolatedSegment[]>([]);
  const lastTickTimeRef = useRef(0);
  const gameStateRef = useRef<GameState>('menu');

  // Effects
  const particlesRef = useRef(new ParticleSystem());
  const shakeRef = useRef(new ScreenShake());
  const bloomRef = useRef(new BloomEffect());

  // Dynamic motion effects
  const squashStretchRef = useRef({ scaleX: 1, scaleY: 1, targetScaleX: 1, targetScaleY: 1 });
  const whipRef = useRef(0); // Tail whip intensity
  const impactFlashRef = useRef(0); // Flash on eat
  const turnSnapRef = useRef(0); // Snap effect on turn

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const borderCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Animation
  const rafRef = useRef<number>(0);
  const gameLoopRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const foodAnimRef = useRef(0);

  // Sync state refs
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { retroSounds.setEnabled(soundEnabled); }, [soundEnabled]);

  // Initialize game
  const initGame = useCallback(() => {
    const mid = Math.floor(gridSize / 2);
    const initialSnake = [
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
    ];
    snakeRef.current = initialSnake;
    foodRef.current = getRandomPosition(gridSize, initialSnake);
    interpolatedSnakeRef.current = initialSnake.map(s => ({
      x: s.x, y: s.y, prevX: s.x, prevY: s.y,
    }));
    setScore(0);
    setIsNewRecord(false);
    directionRef.current = 'RIGHT';
    lastDirectionRef.current = 'RIGHT';
    particlesRef.current.clear();
  }, [gridSize]);

  const startGame = useCallback(() => {
    initGame();
    setGameState('playing');
    retroSounds.playStart();
  }, [initGame]);

  const togglePause = useCallback(() => {
    if (gameState === 'playing') {
      setGameState('paused');
      retroSounds.playPause();
    } else if (gameState === 'paused') {
      setGameState('playing');
    }
  }, [gameState]);

  const gameOver = useCallback(() => {
    setGameState('gameover');
    retroSounds.playGameOver();
    shakeRef.current.trigger(8);

    // Emit explosion particles at snake head
    const head = snakeRef.current[0];
    const canvas = canvasRef.current;
    if (canvas && head) {
      const borderW = 6;
      const gameArea = canvas.width - borderW * 2;
      const cellSize = gameArea / gridSize;
      const px = borderW + head.x * cellSize + cellSize / 2;
      const py = borderW + head.y * cellSize + cellSize / 2;
      particlesRef.current.emit(px, py, 'explosion', 30);
    }

    if (score > highScore) {
      setHighScore(score);
      setIsNewRecord(true);
      localStorage.setItem('snake-highscore-retro', score.toString());
      setTimeout(() => retroSounds.playHighScore(), 800);
    }
  }, [score, highScore, gridSize]);

  // Create static background canvas
  const createStaticBackground = useCallback((canvasWidth: number, canvasHeight: number) => {
    const borderW = 6;
    const gameArea = canvasWidth - borderW * 2;
    const cellSize = gameArea / gridSize;

    // Background canvas
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = canvasWidth;
    bgCanvas.height = canvasHeight;
    const bgCtx = bgCanvas.getContext('2d')!;

    bgCtx.fillStyle = '#0a0a1a';
    bgCtx.fillRect(0, 0, canvasWidth, canvasHeight);

    bgCtx.save();
    bgCtx.translate(borderW, borderW);
    drawCheckerboard(bgCtx, gameArea, gameArea, cellSize);
    bgCtx.restore();

    bgCanvasRef.current = bgCanvas;

    // Border canvas
    const borderCanvas = document.createElement('canvas');
    borderCanvas.width = canvasWidth;
    borderCanvas.height = canvasHeight;
    const borderCtx = borderCanvas.getContext('2d')!;
    drawPixelBorder(borderCtx, canvasWidth, canvasHeight, borderW);
    borderCanvasRef.current = borderCanvas;
  }, [gridSize]);

  // Game logic tick
  useEffect(() => {
    if (gameState !== 'playing') {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      return;
    }

    const speed = level.speed;
    lastTickTimeRef.current = performance.now();

    gameLoopRef.current = window.setInterval(() => {
      const prevSnake = snakeRef.current.map(s => ({ ...s }));

      // Update interpolated positions to current
      interpolatedSnakeRef.current = prevSnake.map(s => ({
        x: s.x, y: s.y, prevX: s.x, prevY: s.y,
      }));

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
        return;
      }

      if (prevSnake.some(segment => segment.x === head.x && segment.y === head.y)) {
        gameOver();
        return;
      }

      const newSnake = [head, ...prevSnake];

      if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
        setScore(prev => prev + 10);
        foodRef.current = getRandomPosition(gridSize, newSnake);
        retroSounds.playEat();
        setScoreFlash(true);
        setTimeout(() => setScoreFlash(false), 300);

        // Impact effects
        impactFlashRef.current = 1;
        whipRef.current = 1;
        shakeRef.current.trigger(6);

        // Squash on eat
        squashStretchRef.current.targetScaleX = 1.4;
        squashStretchRef.current.targetScaleY = 0.7;

        // Emit food particles
        const canvas = canvasRef.current;
        if (canvas) {
          const borderW = 6;
          const gameArea = canvas.width - borderW * 2;
          const cellSize = gameArea / gridSize;
          const px = borderW + head.x * cellSize + cellSize / 2;
          const py = borderW + head.y * cellSize + cellSize / 2;
          particlesRef.current.emit(px, py, 'food', 25);
          particlesRef.current.emit(px, py, 'spark', 10);
        }
      } else {
        newSnake.pop();
      }

      snakeRef.current = newSnake;
      lastTickTimeRef.current = performance.now();

      // Update interpolated snake - set prev to old position, current to new
      interpolatedSnakeRef.current = newSnake.map((s, i) => {
        const prev = prevSnake[i] || prevSnake[prevSnake.length - 1];
        return {
          x: s.x,
          y: s.y,
          prevX: prev.x,
          prevY: prev.y,
        };
      });
    }, speed);

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    };
  }, [gameState, level.speed, gridSize, gameOver]);

  // Render loop (separate from game logic for smooth 60fps)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let lastFrameTime = 0;
    let frameCount = 0;
    let fpsTime = 0;

    const render = (timestamp: number) => {
      // Delta time for effects
      const dt = timestamp - lastFrameTime;
      lastFrameTime = timestamp;

      // FPS counter
      frameCount++;
      fpsTime += dt;
      if (fpsTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        fpsTime = 0;
      }

      // Update effects
      particlesRef.current.update();
      shakeRef.current.update();
      foodAnimRef.current += dt * 0.004;

      // Update squash & stretch with spring physics (snappier)
      const squash = squashStretchRef.current;
      const springSpeed = 0.25;
      const damping = 0.8;
      squash.scaleX += (squash.targetScaleX - squash.scaleX) * springSpeed;
      squash.scaleY += (squash.targetScaleY - squash.scaleY) * springSpeed;
      squash.targetScaleX += (1 - squash.targetScaleX) * damping * 0.15;
      squash.targetScaleY += (1 - squash.targetScaleY) * damping * 0.15;

      // Update whip effect (faster decay for snappier feel)
      whipRef.current *= 0.8;

      // Update impact flash (quick fade for punchy feel)
      impactFlashRef.current *= 0.82;

      // Update turn snap (very quick for snappy turns)
      turnSnapRef.current *= 0.75;

      const borderW = 6;
      const gameArea = canvas.width - borderW * 2;
      const cellSize = gameArea / gridSize;

      // Clear
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Apply screen shake
      ctx.save();
      ctx.translate(shakeRef.current.offsetX, shakeRef.current.offsetY);

      // Draw cached background
      if (bgCanvasRef.current) {
        ctx.drawImage(bgCanvasRef.current, 0, 0);
      }

      // Draw game elements
      ctx.save();
      ctx.translate(borderW, borderW);

      // Food with glow and animation
      const food = foodRef.current;
      const foodPixelSize = Math.max(1, Math.floor(cellSize / 10));
      const foodPulse = Math.sin(foodAnimRef.current * 3) * 0.15 + 1;
      const foodX = food.x * cellSize + (cellSize - foodPixelSize * 10) / 2;
      const foodY = food.y * cellSize + (cellSize - foodPixelSize * 10) / 2;

      // Food glow
      ctx.save();
      ctx.shadowColor = '#ff4444';
      ctx.shadowBlur = 12 + Math.sin(foodAnimRef.current * 3) * 4;
      drawSprite(ctx, FOOD_APPLE, foodX, foodY, foodPixelSize * foodPulse);
      ctx.restore();

      // Snake with interpolation
      const spritePixelSize = Math.max(1, Math.floor(cellSize / 10));
      const interpSnake = interpolatedSnakeRef.current;
      const timeSinceTick = timestamp - lastTickTimeRef.current;
      const t = Math.min(1, timeSinceTick / level.speed);
      const smoothT = smoothstep(t);

      // Emit trail particles behind snake head (only while playing)
      if (gameStateRef.current === 'playing' && interpSnake.length > 0) {
        const headSeg = interpSnake[0];
        const hx = (lerp(headSeg.prevX, headSeg.x, smoothT) + 0.5) * cellSize;
        const hy = (lerp(headSeg.prevY, headSeg.y, smoothT) + 0.5) * cellSize;

        // Aggressive trail - more particles
        if (Math.random() < 0.7) {
          particlesRef.current.emit(hx, hy, 'trail', 3);
        }

        // Extra sparks on turns
        if (turnSnapRef.current > 0.3 && Math.random() < 0.5) {
          particlesRef.current.emit(hx, hy, 'spark', 2);
        }

        // Whip sparks from tail
        if (whipRef.current > 0.3 && interpSnake.length > 2) {
          const tailSeg = interpSnake[interpSnake.length - 1];
          const tx = (lerp(tailSeg.prevX, tailSeg.x, smoothT) + 0.5) * cellSize;
          const ty = (lerp(tailSeg.prevY, tailSeg.y, smoothT) + 0.5) * cellSize;
          if (Math.random() < 0.4) {
            particlesRef.current.emit(tx, ty, 'spark', 1);
          }
        }
      }

      // Draw snake body with glow
      ctx.save();
      ctx.shadowColor = '#4ade80';
      ctx.shadowBlur = 8 + turnSnapRef.current * 15 + whipRef.current * 5;

      const headSquash = squashStretchRef.current;

      for (let i = interpSnake.length - 1; i >= 0; i--) {
        const seg = interpSnake[i];
        let drawX = lerp(seg.prevX, seg.x, smoothT) * cellSize;
        let drawY = lerp(seg.prevY, seg.y, smoothT) * cellSize;
        const offsetX = (cellSize - spritePixelSize * 10) / 2;
        const offsetY = (cellSize - spritePixelSize * 10) / 2;

        if (i === 0) {
          // Head with squash & stretch
          ctx.save();
          const headCenterX = drawX + cellSize / 2;
          const headCenterY = drawY + cellSize / 2;
          ctx.translate(headCenterX, headCenterY);
          ctx.scale(headSquash.scaleX, headSquash.scaleY);
          ctx.translate(-headCenterX, -headCenterY);

          let headSprite;
          switch (directionRef.current) {
            case 'LEFT': headSprite = SNAKE_HEAD_LEFT; break;
            case 'UP': headSprite = SNAKE_HEAD_UP; break;
            case 'DOWN': headSprite = SNAKE_HEAD_DOWN; break;
            default: headSprite = SNAKE_HEAD_RIGHT;
          }
          drawSprite(ctx, headSprite, drawX + offsetX, drawY + offsetY, spritePixelSize);
          ctx.restore();
        } else if (i === interpSnake.length - 1 && interpSnake.length > 1) {
          // Tail with whip effect
          ctx.save();
          const whipOffset = whipRef.current * Math.sin(i * 0.5 + foodAnimRef.current * 10) * 5;
          const tailCenterX = drawX + cellSize / 2 + whipOffset;
          const tailCenterY = drawY + cellSize / 2;
          ctx.translate(tailCenterX, tailCenterY);
          ctx.rotate(whipOffset * 0.15);
          ctx.translate(-tailCenterX, -tailCenterY);
          drawSprite(ctx, SNAKE_TAIL, drawX + offsetX, drawY + offsetY, spritePixelSize);
          ctx.restore();
        } else {
          // Body with wave effect
          const waveOffset = whipRef.current * Math.sin(i * 0.3 + foodAnimRef.current * 8) * 2.5;
          drawSprite(ctx, SNAKE_BODY, drawX + offsetX + waveOffset, drawY + offsetY, spritePixelSize);
        }
      }
      ctx.restore();

      // Particles
      particlesRef.current.draw(ctx);

      ctx.restore(); // game area

      // Draw cached border
      if (borderCanvasRef.current) {
        ctx.drawImage(borderCanvasRef.current, 0, 0);
      }

      ctx.restore(); // shake

      // Impact flash overlay
      if (impactFlashRef.current > 0.01) {
        ctx.save();
        ctx.globalAlpha = impactFlashRef.current * 0.4;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      // Speed lines effect during turns
      if (turnSnapRef.current > 0.3) {
        ctx.save();
        ctx.globalAlpha = turnSnapRef.current * 0.6;
        ctx.strokeStyle = '#86c06c';
        ctx.lineWidth = 2;

        const headSeg = interpSnake[0];
        const headX = borderW + (lerp(headSeg.prevX, headSeg.x, smoothT) + 0.5) * cellSize;
        const headY = borderW + (lerp(headSeg.prevY, headSeg.y, smoothT) + 0.5) * cellSize;

        for (let i = 0; i < 8; i++) {
          const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.3;
          const length = 10 + turnSnapRef.current * 20;
          ctx.beginPath();
          ctx.moveTo(headX + Math.cos(angle) * 5, headY + Math.sin(angle) * 5);
          ctx.lineTo(headX + Math.cos(angle) * length, headY + Math.sin(angle) * length);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Bloom effect (stronger during impacts)
      bloomRef.current.apply(ctx, canvas, 0.35 + impactFlashRef.current * 0.4 + turnSnapRef.current * 0.2);

      // CRT vignette
      const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.width * 0.3,
        canvas.width / 2, canvas.height / 2, canvas.width * 0.7
      );
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // FPS counter on canvas (top-left)
      if (showFps) {
        ctx.save();
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillStyle = '#86c06c';
        ctx.globalAlpha = 0.7;
        ctx.fillText(`${fps} FPS`, 10, 16);
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [gridSize, level.speed]);

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
      bloomRef.current.resize(maxSize, maxSize);
      createStaticBackground(maxSize, maxSize);
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [createStaticBackground]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStateRef.current === 'playing' || gameStateRef.current === 'paused') {
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          togglePause();
          return;
        }
      }

      if (gameStateRef.current === 'gameover' || gameStateRef.current === 'menu') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startGame();
          return;
        }
      }

      if (gameStateRef.current !== 'playing') return;

      const lastDir = lastDirectionRef.current;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          if (lastDir !== 'DOWN') {
            directionRef.current = 'UP';
            retroSounds.playTurn();
            turnSnapRef.current = 1;
            squashStretchRef.current.targetScaleX = 0.8;
            squashStretchRef.current.targetScaleY = 1.3;
          }
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          if (lastDir !== 'UP') {
            directionRef.current = 'DOWN';
            retroSounds.playTurn();
            turnSnapRef.current = 1;
            squashStretchRef.current.targetScaleX = 0.8;
            squashStretchRef.current.targetScaleY = 1.3;
          }
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          if (lastDir !== 'RIGHT') {
            directionRef.current = 'LEFT';
            retroSounds.playTurn();
            turnSnapRef.current = 1;
            squashStretchRef.current.targetScaleX = 1.3;
            squashStretchRef.current.targetScaleY = 0.8;
          }
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          if (lastDir !== 'LEFT') {
            directionRef.current = 'RIGHT';
            retroSounds.playTurn();
            turnSnapRef.current = 1;
            squashStretchRef.current.targetScaleX = 1.3;
            squashStretchRef.current.targetScaleY = 0.8;
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePause, startGame]);

  // Touch controls
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || gameStateRef.current !== 'playing') return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const minSwipe = 30;

    if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) return;

    const lastDir = lastDirectionRef.current;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0 && lastDir !== 'LEFT') {
        directionRef.current = 'RIGHT';
        retroSounds.playTurn();
        turnSnapRef.current = 1;
        squashStretchRef.current.targetScaleX = 1.3;
        squashStretchRef.current.targetScaleY = 0.8;
      }
      else if (dx < 0 && lastDir !== 'RIGHT') {
        directionRef.current = 'LEFT';
        retroSounds.playTurn();
        turnSnapRef.current = 1;
        squashStretchRef.current.targetScaleX = 1.3;
        squashStretchRef.current.targetScaleY = 0.8;
      }
    } else {
      if (dy > 0 && lastDir !== 'UP') {
        directionRef.current = 'DOWN';
        retroSounds.playTurn();
        turnSnapRef.current = 1;
        squashStretchRef.current.targetScaleX = 0.8;
        squashStretchRef.current.targetScaleY = 1.3;
      }
      else if (dy < 0 && lastDir !== 'DOWN') {
        directionRef.current = 'UP';
        retroSounds.playTurn();
        turnSnapRef.current = 1;
        squashStretchRef.current.targetScaleX = 0.8;
        squashStretchRef.current.targetScaleY = 1.3;
      }
    }

    touchStartRef.current = null;
  }, []);

  // Direction buttons
  const handleDirectionButton = (dir: Direction) => {
    if (gameStateRef.current !== 'playing') return;
    const lastDir = lastDirectionRef.current;
    if (dir === 'UP' && lastDir !== 'DOWN') {
      directionRef.current = 'UP';
      retroSounds.playTurn();
      turnSnapRef.current = 1;
      squashStretchRef.current.targetScaleX = 0.8;
      squashStretchRef.current.targetScaleY = 1.3;
    }
    if (dir === 'DOWN' && lastDir !== 'UP') {
      directionRef.current = 'DOWN';
      retroSounds.playTurn();
      turnSnapRef.current = 1;
      squashStretchRef.current.targetScaleX = 0.8;
      squashStretchRef.current.targetScaleY = 1.3;
    }
    if (dir === 'LEFT' && lastDir !== 'RIGHT') {
      directionRef.current = 'LEFT';
      retroSounds.playTurn();
      turnSnapRef.current = 1;
      squashStretchRef.current.targetScaleX = 1.3;
      squashStretchRef.current.targetScaleY = 0.8;
    }
    if (dir === 'RIGHT' && lastDir !== 'LEFT') {
      directionRef.current = 'RIGHT';
      retroSounds.playTurn();
      turnSnapRef.current = 1;
      squashStretchRef.current.targetScaleX = 1.3;
      squashStretchRef.current.targetScaleY = 0.8;
    }
  };

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
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>
          <button
            onClick={() => setShowFps(!showFps)}
            className="font-retro text-xs text-[#567c45] hover:text-[#86c06c] transition-colors"
          >
            {showFps ? `${fps} FPS` : 'FPS'}
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

        <div className="hidden md:flex justify-center mt-1">
          <p className="font-retro text-[#306850] text-sm">
            ← ↑ ↓ → или W A S D • P/Esc — пауза
          </p>
        </div>
      </div>

      <div className="mt-3 text-center">
        <p className="font-retro text-[#1a3a1a] text-xs">
          РЕТРО АРКАДА © 2025
        </p>
      </div>
    </div>
  );
}

export default App;
