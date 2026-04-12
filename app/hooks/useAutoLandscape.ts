import { useEffect, useRef } from 'react';
import { Dimensions, Platform } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

/**
 * Auto-expand a chart to full-screen when the device rotates to landscape.
 * Only triggers on phones (shortest screen dimension < 768px).
 *
 * Usage:
 *   useAutoLandscape({
 *     isExpanded,
 *     onExpand: () => setExpanded(true),
 *     onCollapse: () => setExpanded(false),
 *     enabled: true,  // false when e.g. a form is open
 *   })
 *
 * Per PRD-landscape-charts Phase B:
 * - Only triggers on orientation *change*, not on mount (if user is already
 *   holding phone sideways, we don't know they want full-screen)
 * - Rotating back to portrait always closes, regardless of how full-screen was entered
 * - Tablets (shortest dimension >= 768px) never auto-trigger
 */
export function useAutoLandscape({
  isExpanded,
  onExpand,
  onCollapse,
  enabled = true,
}: {
  isExpanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  enabled?: boolean;
}) {
  const hasMounted = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Check if this is a phone (not a tablet)
    const { width, height } = Dimensions.get('screen');
    const shortestDimension = Math.min(width, height);
    if (shortestDimension >= 768) return; // Tablet — don't auto-trigger

    const subscription = ScreenOrientation.addOrientationChangeListener((event) => {
      if (!hasMounted.current) {
        hasMounted.current = true;
        return; // Skip the initial orientation report
      }

      if (!enabled) return;

      const orientation = event.orientationInfo.orientation;
      const isLandscape =
        orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;

      if (isLandscape && !isExpanded) {
        onExpand();
      } else if (!isLandscape && isExpanded) {
        // Rotating back to portrait always closes, regardless of how it was opened
        onCollapse();
      }
    });

    // Mark as mounted after a short delay to skip any initial orientation events
    const timer = setTimeout(() => {
      hasMounted.current = true;
    }, 500);

    return () => {
      subscription.remove();
      clearTimeout(timer);
    };
  }, [isExpanded, onExpand, onCollapse, enabled]);
}
