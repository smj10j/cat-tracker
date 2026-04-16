import { useColorScheme } from 'nativewind';
import { palette, type Palette } from '../lib/colors';

/**
 * Returns the active theme palette. Use this in components that need
 * inline `style={{ }}` color values — anything reachable through Tailwind
 * classes (`bg-night`, `text-ink`, `text-brand`, etc.) should use those
 * instead.
 *
 * The returned object includes brand and health tokens that vary per theme
 * (Phase 0 of PRD-visual-identity-v2). Components must NOT import hardcoded
 * hexes anymore — pull from this hook.
 */
export function useThemeColors(): Palette {
  const { colorScheme } = useColorScheme();
  return palette[colorScheme ?? 'dark'];
}
