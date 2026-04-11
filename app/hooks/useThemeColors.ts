import { useColorScheme } from 'nativewind';
import { palette, accent } from '../lib/colors';

/** Returns the current theme palette merged with accent colors.
 *  Use this in components that need inline style={{ }} color values. */
export function useThemeColors() {
  const { colorScheme } = useColorScheme();
  const colors = palette[colorScheme ?? 'dark'];
  return { ...colors, ...accent };
}
