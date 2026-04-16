import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  THEME_TOKEN_CONTRACT,
  CRITICAL_CONTRAST_PAIRS,
} from '../lib/themeTokens';

/**
 * Parse a CSS file and return a map of `selector → Set<token-name>` for every
 * top-level rule whose body declares at least one `--color-*` custom property.
 *
 * Also returns a companion map of `selector → Map<token-name, value>` for
 * contrast testing.
 */
function extractColorTokensBySelector(css: string) {
  // Strip comments and @-directives (@tailwind, @import, etc.)
  const stripped = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@[\w-]+[^{]*;/g, '');
  const tokens = new Map<string, Set<string>>();
  const values = new Map<string, Map<string, string>>();

  const ruleRe = /([^{}@]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(stripped)) !== null) {
    const selector = m[1].trim();
    const body = m[2];
    const tSet = new Set<string>();
    const vMap = new Map<string, string>();
    const declRe = /--(color-[a-z0-9-]+)\s*:\s*([^;]+)/g;
    let d: RegExpExecArray | null;
    while ((d = declRe.exec(body)) !== null) {
      tSet.add(d[1]);
      vMap.set(d[1], d[2].trim());
    }
    if (tSet.size > 0) {
      tokens.set(selector, tSet);
      values.set(selector, vMap);
    }
  }
  return { tokens, values };
}

/**
 * Parse a hex color (#RGB, #RRGGBB, or #RRGGBBAA) into [r, g, b] 0-255.
 * Returns null for non-hex values (rgba, var references, etc.).
 */
function parseHex(hex: string): [number, number, number] | null {
  const m = hex.match(/^#([0-9a-f]{3,8})$/i);
  if (!m) return null;
  const h = m[1];
  if (h.length === 3) {
    return [parseInt(h[0]+h[0], 16), parseInt(h[1]+h[1], 16), parseInt(h[2]+h[2], 16)];
  }
  if (h.length >= 6) {
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  return null;
}

/**
 * Relative luminance per WCAG 2.1 §1.4.3.
 */
function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Contrast ratio per WCAG 2.1 §1.4.3.
 */
function contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
  const l1 = luminance(...fg);
  const l2 = luminance(...bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ─── Paths ──────────────────────────────────────────────────────────────────

const WEB_CSS_PATH = join(__dirname, '..', '..', 'frontend', 'src', 'index.css');
const IOS_CSS_PATH = join(__dirname, '..', '..', 'app', 'global.css');
const CONTRACT = new Set(THEME_TOKEN_CONTRACT);

// ─── Web parity ─────────────────────────────────────────────────────────────

describe('Theme token contract — web (frontend/src/index.css)', () => {
  const css = readFileSync(WEB_CSS_PATH, 'utf-8');
  const { tokens, values } = extractColorTokensBySelector(css);

  // Every top-level block with --color-* declarations is a theme variant.
  // Phase 1 adds compound selectors like `:root, [data-theme-family="lamplight"][data-theme="dark"]`.
  const variantSelectors = Array.from(tokens.keys());

  it('finds at least two variant blocks (dark + light)', () => {
    expect(variantSelectors.length).toBeGreaterThanOrEqual(2);
  });

  it.each(variantSelectors)('block "%s" defines exactly the contract tokens', (selector) => {
    const declared = tokens.get(selector)!;
    const missing = THEME_TOKEN_CONTRACT.filter((t) => !declared.has(t));
    const extra = Array.from(declared).filter((t) => !CONTRACT.has(t));
    expect({ selector, missing, extra }).toEqual({ selector, missing: [], extra: [] });
  });

  it.each(variantSelectors)('block "%s" passes AA contrast on critical pairs', (selector) => {
    const vMap = values.get(selector)!;
    for (const [fgToken, bgToken, minRatio, label] of CRITICAL_CONTRAST_PAIRS) {
      const fgHex = vMap.get(fgToken);
      const bgHex = vMap.get(bgToken);
      const fg = fgHex ? parseHex(fgHex) : null;
      const bg = bgHex ? parseHex(bgHex) : null;
      if (!fg || !bg) continue;
      const ratio = contrastRatio(fg, bg);
      expect(
        ratio,
        `${selector}: ${label} (${fgToken} on ${bgToken}): ${ratio.toFixed(2)}:1 < ${minRatio}:1`,
      ).toBeGreaterThanOrEqual(minRatio);
    }
  });
});

// ─── iOS parity ─────────────────────────────────────────────────────────────

describe('Theme token contract — iOS (app/global.css)', () => {
  const css = readFileSync(IOS_CSS_PATH, 'utf-8');
  const { tokens, values } = extractColorTokensBySelector(css);

  const variantSelectors = Array.from(tokens.keys());

  it('finds at least two variant blocks (dark + light)', () => {
    expect(variantSelectors.length).toBeGreaterThanOrEqual(2);
  });

  it.each(variantSelectors)('block "%s" defines exactly the contract tokens', (selector) => {
    const declared = tokens.get(selector)!;
    const missing = THEME_TOKEN_CONTRACT.filter((t) => !declared.has(t));
    const extra = Array.from(declared).filter((t) => !CONTRACT.has(t));
    expect({ selector, missing, extra }).toEqual({ selector, missing: [], extra: [] });
  });

  it.each(variantSelectors)('block "%s" passes AA contrast on critical pairs', (selector) => {
    const vMap = values.get(selector)!;
    for (const [fgToken, bgToken, minRatio, label] of CRITICAL_CONTRAST_PAIRS) {
      const fgHex = vMap.get(fgToken);
      const bgHex = vMap.get(bgToken);
      const fg = fgHex ? parseHex(fgHex) : null;
      const bg = bgHex ? parseHex(bgHex) : null;
      if (!fg || !bg) continue;
      const ratio = contrastRatio(fg, bg);
      expect(
        ratio,
        `${selector}: ${label} (${fgToken} on ${bgToken}): ${ratio.toFixed(2)}:1 < ${minRatio}:1`,
      ).toBeGreaterThanOrEqual(minRatio);
    }
  });
});
