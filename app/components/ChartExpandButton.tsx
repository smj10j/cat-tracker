import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeColors } from '../hooks/useThemeColors';

const HINT_STORAGE_KEY = 'chart-expand-hint-seen';

interface ChartExpandButtonProps {
  onPress: () => void;
  visible: boolean;
}

export function ChartExpandButton({ onPress, visible }: ChartExpandButtonProps) {
  const colors = useThemeColors();
  const [showHint, setShowHint] = useState(false);
  const hintOpacity = useRef(new Animated.Value(0)).current;
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    AsyncStorage.getItem(HINT_STORAGE_KEY).then((seen) => {
      if (cancelled || seen === 'true') return;

      showTimer.current = setTimeout(() => {
        if (cancelled) return;
        setShowHint(true);
        Animated.timing(hintOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }).start();

        dismissTimer.current = setTimeout(() => {
          if (cancelled) return;
          Animated.timing(hintOpacity, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }).start(() => setShowHint(false));
        }, 3000);

        AsyncStorage.setItem(HINT_STORAGE_KEY, 'true');
      }, 1000);
    });

    return () => {
      cancelled = true;
      if (showTimer.current) clearTimeout(showTimer.current);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [visible, hintOpacity]);

  if (!visible) return null;

  return (
    <View style={styles.container}>
      {showHint && (
        <Animated.View
          style={[
            styles.tooltip,
            {
              backgroundColor: colors.surfaceHi,
              borderColor: colors.rim,
              opacity: hintOpacity,
            },
          ]}
        >
          <Text style={[styles.tooltipText, { color: colors.ink }]}>
            Tap to expand chart
          </Text>
          <View
            style={[styles.tooltipArrow, { borderTopColor: colors.surfaceHi }]}
          />
        </Animated.View>
      )}
      <Pressable
        onPress={onPress}
        accessibilityLabel="Expand chart"
        accessibilityRole="button"
        style={[
          styles.button,
          { backgroundColor: colors.card, borderColor: colors.rim },
        ]}
      >
        <View style={styles.expandIcon}>
          <View style={[styles.expandArrow, styles.expandArrowTR, { borderColor: colors.inkMid }]} />
          <View style={[styles.expandArrow, styles.expandArrowBL, { borderColor: colors.inkMid }]} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    alignItems: 'center',
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandIcon: {
    width: 18,
    height: 18,
    position: 'relative',
  },
  expandArrow: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderWidth: 1.5,
  },
  expandArrowTR: {
    top: 0,
    right: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
  },
  expandArrowBL: {
    bottom: 0,
    left: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
  },
  tooltip: {
    position: 'absolute',
    bottom: 50,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 0,
  },
  tooltipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  tooltipArrow: {
    position: 'absolute',
    bottom: -6,
    right: 14,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
