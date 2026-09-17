// Pixel art sprites drawn programmatically
// All sprites are defined as 2D arrays of color indices

export type Sprite = string[][];

// Color palette (Game Boy inspired)
export const PALETTE = {
  transparent: 'transparent',
  darkest: '#0f380f',
  dark: '#306850',
  medium: '#567c45',
  light: '#86c06c',
  lightest: '#e0f8d0',
  // Food colors
  red: '#c03030',
  darkRed: '#801818',
  brightRed: '#f04040',
  leaf: '#306850',
  brightLeaf: '#86c06c',
  // Gold
  gold: '#d4a017',
  darkGold: '#8b6914',
  brightGold: '#ffd700',
  // Snake eyes
  white: '#e0f8d0',
  black: '#0f0f0f',
};

// Snake head facing RIGHT (12x12) - more detailed
export const SNAKE_HEAD_RIGHT: Sprite = [
  ['', '', '', '', 'dk', 'dk', 'dk', 'dk', '', '', '', ''],
  ['', '', '', 'dk', 'lt', 'lt', 'lt', 'lt', 'dk', '', '', ''],
  ['', '', 'dk', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'dk', '', ''],
  ['', 'dk', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'dk', ''],
  ['dk', 'lt', 'lt', 'wh', 'bk', 'lt', 'lt', 'wh', 'bk', 'lt', 'lt', 'dk'],
  ['dk', 'lt', 'lt', 'bk', 'bk', 'lt', 'lt', 'bk', 'bk', 'lt', 'lt', 'dk'],
  ['dk', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'dk'],
  ['dk', 'lt', 'lt', 'lt', 'md', 'md', 'md', 'md', 'lt', 'lt', 'lt', 'dk'],
  ['', 'dk', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'dk', ''],
  ['', '', 'dk', 'lt', 'lt', 'md', 'md', 'lt', 'lt', 'dk', '', ''],
  ['', '', '', 'dk', 'md', 'md', 'md', 'md', 'dk', '', '', ''],
  ['', '', '', '', 'dk', 'dk', 'dk', 'dk', '', '', '', ''],
];

// Snake head facing LEFT (12x12) - more detailed
export const SNAKE_HEAD_LEFT: Sprite = [
  ['', '', '', '', 'dk', 'dk', 'dk', 'dk', '', '', '', ''],
  ['', '', '', 'dk', 'lt', 'lt', 'lt', 'lt', 'dk', '', '', ''],
  ['', '', 'dk', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'dk', '', ''],
  ['', 'dk', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'dk', ''],
  ['dk', 'lt', 'lt', 'bk', 'wh', 'lt', 'lt', 'bk', 'wh', 'lt', 'lt', 'dk'],
  ['dk', 'lt', 'lt', 'bk', 'bk', 'lt', 'lt', 'bk', 'bk', 'lt', 'lt', 'dk'],
  ['dk', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'dk'],
  ['dk', 'lt', 'lt', 'md', 'md', 'md', 'md', 'lt', 'lt', 'lt', 'lt', 'dk'],
  ['', 'dk', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'dk', ''],
  ['', '', 'dk', 'lt', 'lt', 'md', 'md', 'lt', 'lt', 'dk', '', ''],
  ['', '', '', 'dk', 'md', 'md', 'md', 'md', 'dk', '', '', ''],
  ['', '', '', '', 'dk', 'dk', 'dk', 'dk', '', '', '', ''],
];

// Snake head facing UP (12x12) - more detailed
export const SNAKE_HEAD_UP: Sprite = [
  ['', '', '', '', 'dk', 'dk', 'dk', 'dk', '', '', '', ''],
  ['', '', '', 'dk', 'lt', 'lt', 'lt', 'lt', 'dk', '', '', ''],
  ['', '', 'dk', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'dk', '', ''],
  ['', 'dk', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'dk', ''],
  ['dk', 'lt', 'lt', 'wh', 'bk', 'lt', 'lt', 'wh', 'bk', 'lt', 'lt', 'dk'],
  ['dk', 'lt', 'lt', 'bk', 'bk', 'lt', 'lt', 'bk', 'bk', 'lt', 'lt', 'dk'],
  ['dk', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'dk'],
  ['dk', 'lt', 'lt', 'md', 'md', 'md', 'md', 'md', 'lt', 'lt', 'lt', 'dk'],
  ['', 'dk', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'dk', ''],
  ['', '', 'dk', 'lt', 'lt', 'md', 'md', 'lt', 'lt', 'dk', '', ''],
  ['', '', '', 'dk', 'md', 'md', 'md', 'md', 'dk', '', '', ''],
  ['', '', '', '', 'dk', 'dk', 'dk', 'dk', '', '', '', ''],
];

// Snake head facing DOWN (12x12) - more detailed
export const SNAKE_HEAD_DOWN: Sprite = [
  ['', '', '', '', 'dk', 'dk', 'dk', 'dk', '', '', '', ''],
  ['', '', '', 'dk', 'md', 'md', 'md', 'md', 'dk', '', '', ''],
  ['', '', 'dk', 'lt', 'lt', 'md', 'md', 'lt', 'lt', 'dk', '', ''],
  ['', 'dk', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'dk', ''],
  ['dk', 'lt', 'lt', 'wh', 'bk', 'lt', 'lt', 'wh', 'bk', 'lt', 'lt', 'dk'],
  ['dk', 'lt', 'lt', 'bk', 'bk', 'lt', 'lt', 'bk', 'bk', 'lt', 'lt', 'dk'],
  ['dk', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'dk'],
  ['dk', 'lt', 'lt', 'md', 'md', 'md', 'md', 'md', 'lt', 'lt', 'lt', 'dk'],
  ['', 'dk', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'dk', ''],
  ['', '', 'dk', 'lt', 'lt', 'md', 'md', 'lt', 'lt', 'dk', '', ''],
  ['', '', '', 'dk', 'md', 'md', 'md', 'md', 'dk', '', '', ''],
  ['', '', '', '', 'dk', 'dk', 'dk', 'dk', '', '', '', ''],
];

// Snake body segment (12x12) - more detailed with scales
export const SNAKE_BODY: Sprite = [
  ['', '', '', 'dk', 'dk', 'dk', 'dk', 'dk', 'dk', '', '', ''],
  ['', '', 'dk', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'dk', '', ''],
  ['', 'dk', 'lt', 'lt', 'md', 'lt', 'lt', 'md', 'lt', 'lt', 'dk', ''],
  ['dk', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'dk'],
  ['dk', 'lt', 'md', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'md', 'lt', 'dk'],
  ['dk', 'lt', 'lt', 'lt', 'lt', 'md', 'md', 'lt', 'lt', 'lt', 'lt', 'dk'],
  ['dk', 'lt', 'lt', 'lt', 'lt', 'md', 'md', 'lt', 'lt', 'lt', 'lt', 'dk'],
  ['dk', 'lt', 'md', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'md', 'lt', 'dk'],
  ['dk', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'dk'],
  ['', 'dk', 'lt', 'lt', 'md', 'lt', 'lt', 'md', 'lt', 'lt', 'dk', ''],
  ['', '', 'dk', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'dk', '', ''],
  ['', '', '', 'dk', 'dk', 'dk', 'dk', 'dk', 'dk', '', '', ''],
];

// Snake tail (12x12) - more detailed with taper
export const SNAKE_TAIL: Sprite = [
  ['', '', '', '', '', 'dk', 'dk', '', '', '', '', ''],
  ['', '', '', '', 'dk', 'lt', 'lt', 'dk', '', '', '', ''],
  ['', '', '', 'dk', 'lt', 'lt', 'lt', 'lt', 'dk', '', '', ''],
  ['', '', 'dk', 'lt', 'lt', 'md', 'lt', 'lt', 'lt', 'dk', '', ''],
  ['', 'dk', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'dk', ''],
  ['dk', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'dk'],
  ['dk', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'dk'],
  ['', 'dk', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'lt', 'dk', ''],
  ['', '', 'dk', 'lt', 'lt', 'md', 'lt', 'lt', 'lt', 'dk', '', ''],
  ['', '', '', 'dk', 'lt', 'lt', 'lt', 'lt', 'dk', '', '', ''],
  ['', '', '', '', 'dk', 'dk', 'dk', 'dk', '', '', '', ''],
  ['', '', '', '', '', 'dk', 'dk', '', '', '', '', ''],
];

// Apple/Food (12x12) - more detailed
export const FOOD_APPLE: Sprite = [
  ['', '', '', '', '', 'lf', 'bl', '', '', '', '', ''],
  ['', '', '', '', 'lf', 'bl', '', '', '', '', '', ''],
  ['', '', '', 'lf', 'bl', '', '', '', '', '', '', ''],
  ['', '', 'dr', 'dr', 'dr', 'br', 'br', 'dr', '', '', '', ''],
  ['', 'dr', 'br', 'br', 'br', 'br', 'br', 'br', 'br', 'dr', '', ''],
  ['dr', 'br', 'br', 'wh', 'wh', 'br', 'br', 'br', 'br', 'br', 'dr', ''],
  ['dr', 'br', 'br', 'wh', 'br', 'br', 'br', 'br', 'br', 'br', 'dr', ''],
  ['dr', 'br', 'br', 'br', 'br', 'br', 'br', 'br', 'br', 'br', 'dr', ''],
  ['dr', 'br', 'br', 'br', 'br', 'br', 'br', 'br', 'br', 'br', 'dr', ''],
  ['', 'dr', 'br', 'br', 'br', 'br', 'br', 'br', 'br', 'dr', '', ''],
  ['', '', 'dr', 'dr', 'dr', 'dr', 'dr', 'dr', 'dr', '', '', ''],
  ['', '', '', '', '', '', '', '', '', '', '', ''],
];

// Color mapping for sprites
export const COLOR_MAP: Record<string, string> = {
  'dk': PALETTE.dark,
  'lt': PALETTE.light,
  'md': PALETTE.medium,
  'bk': PALETTE.black,
  'wh': PALETTE.white,
  'dr': PALETTE.darkRed,
  'br': PALETTE.brightRed,
  'rd': PALETTE.red,
  'lf': PALETTE.leaf,
  'bl': PALETTE.brightLeaf,
  'gd': PALETTE.gold,
  'dg': PALETTE.darkGold,
  'bg': PALETTE.brightGold,
};

// Draw a sprite on canvas
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  x: number,
  y: number,
  pixelSize: number
) {
  for (let row = 0; row < sprite.length; row++) {
    for (let col = 0; col < sprite[row].length; col++) {
      const colorKey = sprite[row][col];
      if (colorKey && COLOR_MAP[colorKey]) {
        ctx.fillStyle = COLOR_MAP[colorKey];
        ctx.fillRect(
          x + col * pixelSize,
          y + row * pixelSize,
          pixelSize,
          pixelSize
        );
      }
    }
  }
}

// Draw checkerboard background
export function drawCheckerboard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cellSize: number
) {
  const color1 = '#1a3a1a';
  const color2 = '#162e16';

  for (let row = 0; row < height / cellSize; row++) {
    for (let col = 0; col < width / cellSize; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? color1 : color2;
      ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
    }
  }
}

// Draw pixel border around game area
export function drawPixelBorder(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  borderWidth: number
) {
  // Outer border
  ctx.fillStyle = '#0f380f';
  ctx.fillRect(0, 0, width, borderWidth);
  ctx.fillRect(0, height - borderWidth, width, borderWidth);
  ctx.fillRect(0, 0, borderWidth, height);
  ctx.fillRect(width - borderWidth, 0, borderWidth, height);

  // Inner highlight
  ctx.fillStyle = '#306850';
  ctx.fillRect(borderWidth, borderWidth, width - borderWidth * 2, 2);
  ctx.fillRect(borderWidth, borderWidth, 2, height - borderWidth * 2);

  // Inner shadow
  ctx.fillStyle = '#0a200a';
  ctx.fillRect(borderWidth, height - borderWidth - 2, width - borderWidth * 2, 2);
  ctx.fillRect(width - borderWidth - 2, borderWidth, 2, height - borderWidth * 2);

  // Corner decorations
  const cornerSize = borderWidth * 2;
  ctx.fillStyle = '#86c06c';
  // Top-left
  ctx.fillRect(0, 0, cornerSize, 3);
  ctx.fillRect(0, 0, 3, cornerSize);
  // Top-right
  ctx.fillRect(width - cornerSize, 0, cornerSize, 3);
  ctx.fillRect(width - 3, 0, 3, cornerSize);
  // Bottom-left
  ctx.fillRect(0, height - 3, cornerSize, 3);
  ctx.fillRect(0, height - cornerSize, 3, cornerSize);
  // Bottom-right
  ctx.fillRect(width - cornerSize, height - 3, cornerSize, 3);
  ctx.fillRect(width - 3, height - cornerSize, 3, cornerSize);
}
