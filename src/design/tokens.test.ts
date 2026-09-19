import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { accent, danger, info, ink, line, neutral, reward, special, text } from './tokens';

/**
 * The canvas renderer reads the TS tokens and the DOM reads the `@theme` block.
 * Nothing stops the two drifting apart except this test.
 */
function themeVars(): Record<string, string> {
  const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
  const block = css.match(/@theme\s*\{([\s\S]*?)\n\}/);
  if (!block) throw new Error('no @theme block in src/index.css');
  const out: Record<string, string> = {};
  for (const [, name, value] of block[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    // CSS formatting is Prettier's business; compare values, not whitespace.
    out[name] = value.trim().replace(/\s+/g, '');
  }
  return out;
}

describe('design tokens', () => {
  const vars = themeVars();

  const expected: Record<string, string> = {
    '--color-ink-950': ink[950],
    '--color-ink-900': ink[900],
    '--color-ink-800': ink[800],
    '--color-ink-700': ink[700],
    '--color-ink-600': ink[600],
    '--color-ink-500': ink[500],
    '--color-fg': text.primary,
    '--color-fg-soft': text.secondary,
    '--color-fg-mute': text.muted,
    '--color-accent-soft': accent.soft,
    '--color-accent': accent.base,
    '--color-accent-deep': accent.deep,
    '--color-reward-soft': reward.soft,
    '--color-reward': reward.base,
    '--color-reward-deep': reward.deep,
    '--color-danger-soft': danger.soft,
    '--color-danger': danger.base,
    '--color-danger-deep': danger.deep,
    '--color-info-soft': info.soft,
    '--color-info': info.base,
    '--color-info-deep': info.deep,
    '--color-special-soft': special.soft,
    '--color-special': special.base,
    '--color-special-deep': special.deep,
    '--color-neutral-soft': neutral.soft,
    '--color-neutral': neutral.base,
    '--color-neutral-deep': neutral.deep,
    '--color-line-subtle': line.subtle,
    '--color-line': line.base,
    '--color-line-strong': line.strong,
  };

  for (const [name, value] of Object.entries(expected)) {
    it(`${name} matches src/design/tokens.ts`, () => {
      expect(vars[name]).toBe(value.replace(/\s+/g, ''));
    });
  }

  it('every palette family exposes soft, base and deep', () => {
    for (const family of [accent, reward, danger, info, special, neutral]) {
      expect(Object.keys(family).sort()).toEqual(['base', 'deep', 'soft']);
    }
  });
});
