import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { THEME_TOKEN_CONTRACT } from '../lib/themeTokens';

/**
 * Parse a CSS file and return a map of `selector → Set<token-name>` for every
 * top-level rule whose body declares at least one `--color-*` custom property.
 *
 * Bare-bones — does NOT handle nested at-rules, comments inside selectors, or
 * media queries. Adequate for the small, hand-edited theme stylesheets in this
 * project; if the CSS grows in complexity, replace with `postcss`.
 */
function extractColorTokensBySelector(css: string): Map<string, Set<string>> {
  // Strip /* … */ comments first so they don't interfere with the rule scan.
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = new Map<string, Set<string>>();

  // Match `selector { … }` at the top level.
  // Selectors can include commas, brackets, colons; body is everything until
  // the matching `}` (no nested braces in our stylesheets at the top level —
  // @layer wrappers are handled separately below).
  const ruleRe = /([^{}@]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(stripped)) !== null) {
    const selector = m[1].trim();
    const body = m[2];
    const tokens = new Set<string>();
    const declRe = /--(color-[a-z0-9-]+)\s*:/g;
    let d: RegExpExecArray | null;
    while ((d = declRe.exec(body)) !== null) {
      tokens.add(d[1]);
    }
    if (tokens.size > 0) out.set(selector, tokens);
  }
  return out;
}

const WEB_CSS_PATH = join(__dirname, '..', '..', 'frontend', 'src', 'index.css');
const CONTRACT = new Set(THEME_TOKEN_CONTRACT);

describe('Theme token contract — web (frontend/src/index.css)', () => {
  const css = readFileSync(WEB_CSS_PATH, 'utf-8');
  const blocks = extractColorTokensBySelector(css);

  // Every theme variant block lives at the top level. Today there are two:
  // `:root` (current dark) and `[data-theme="light"]`. Phase 1 will add
  // 8 more (warmnight/forest/linen/almanac × dark/light).
  const variantSelectors = Array.from(blocks.keys()).filter(
    (s) => s === ':root' || s.startsWith('[data-theme'),
  );

  it('finds at least one variant block', () => {
    expect(variantSelectors.length).toBeGreaterThan(0);
  });

  it.each(variantSelectors)('block %s defines exactly the contract tokens', (selector) => {
    const declared = blocks.get(selector)!;
    const missing = THEME_TOKEN_CONTRACT.filter((t) => !declared.has(t));
    const extra = Array.from(declared).filter((t) => !CONTRACT.has(t));
    expect({ selector, missing, extra }).toEqual({ selector, missing: [], extra: [] });
  });
});
