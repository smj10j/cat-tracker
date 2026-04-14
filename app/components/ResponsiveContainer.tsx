import { View, type ViewStyle } from 'react-native';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Override the default max width (640) */
  maxWidth?: number;
}

/**
 * Constrains content width on wide screens (iPad) and centers it.
 * On iPhone: behaves like a View with paddingHorizontal: 16.
 * On iPad: constrains to 640px centered with 24px padding.
 *
 * Does NOT set overflow: 'hidden' — scrolling passes through unaffected.
 */
export function ResponsiveContainer({ children, style, maxWidth }: Props) {
  const { contentMaxWidth, contentPadding } = useResponsiveLayout();
  const effectiveMax = maxWidth ?? contentMaxWidth;

  return (
    <View
      style={[
        {
          width: '100%',
          maxWidth: effectiveMax,
          alignSelf: 'center',
          paddingHorizontal: contentPadding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
