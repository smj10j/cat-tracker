import { useColorScheme } from 'nativewind';
import { familyPalettes, type Palette } from '../lib/colors';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Returns the active theme palette. Use this in components that need
 * inline `style={{ }}` color values — anything reachable through Tailwind
 * classes (`bg-night`, `text-ink`, `text-brand`, etc.) should use those
 * instead.
 *
 * The returned object includes brand and health tokens that vary per
 * family and mode (Phase 1 of PRD-visual-identity-v2). Components must
 * NOT import hardcoded hexes anymore — pull from this hook.
 *
 * **Limitation (Phase 1):** NativeWind CSS vars in `global.css` remain
 * fixed at lamplight values. Inline styles (this hook) correctly reflect
 * the active family, but Tailwind utility classes (`bg-night`, `text-ink`)
 * stay on lamplight for non-default families. Since most color usage in
 * the iOS app is through inline styles, this is acceptable for v1.
 */
export function useThemeColors(): Palette {
  const { colorScheme } = useColorScheme();
  const { family } = useTheme();
  const mode = colorScheme ?? 'dark';
  return familyPalettes[family][mode];
}
