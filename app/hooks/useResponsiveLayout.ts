import { useWindowDimensions } from 'react-native';

const CONTENT_MAX_WIDTH = 640;
const WIDE_BREAKPOINT = 768;

/**
 * Provides responsive layout values that adapt to screen width.
 * On iPhone: returns phone defaults (16px padding, no maxWidth constraint).
 * On iPad / wide screens: constrains content to 640px centered with 24px padding.
 *
 * The `rv` helper picks between phone and tablet values:
 *   rv(56, 68) → 56 on iPhone, 68 on iPad
 */
export function useResponsiveLayout() {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  function rv<T>(phone: T, tablet: T): T {
    return isWide ? tablet : phone;
  }

  return {
    screenWidth: width,
    isWide,
    contentMaxWidth: isWide ? CONTENT_MAX_WIDTH : undefined,
    contentPadding: isWide ? 24 : 16,
    rv,
  };
}
