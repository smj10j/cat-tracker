import { useEffect, useRef, useCallback, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useThemeColors } from '../hooks/useThemeColors';

const DISMISS_EDGE = 60; // Top edge zone for swipe-down dismiss (px)
const DISMISS_THRESHOLD = 80; // Vertical distance to trigger dismiss (px)

interface FullScreenChartModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** Render prop receives measured chart area dimensions so charts adapt to orientation */
  children: React.ReactNode | ((layout: { width: number; height: number }) => React.ReactNode);
}

export function FullScreenChartModal({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: FullScreenChartModalProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const isSwipingDown = useRef(false);
  const [chartLayout, setChartLayout] = useState({ width: 0, height: 0 });

  const onChartAreaLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setChartLayout({ width, height });
  }, []);

  // Orientation lock: unlock when modal opens, lock back when it closes
  useEffect(() => {
    if (Platform.OS === 'web') return;

    if (visible) {
      ScreenOrientation.unlockAsync();
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }

    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, [visible]);

  // Fade-in animation on mount
  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
      translateY.setValue(0);
    }
  }, [visible, fadeAnim, translateY]);

  const handleClose = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      translateY.setValue(0);
      onClose();
    });
  }, [fadeAnim, translateY, onClose]);

  // Swipe-down dismiss from top edge (Phase C)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        // Only capture if touch starts in the top edge zone
        return evt.nativeEvent.pageY < DISMISS_EDGE + (insets.top || 0);
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Capture if moving downward from top edge
        return (
          evt.nativeEvent.pageY < DISMISS_EDGE + (insets.top || 0) + 40 &&
          gestureState.dy > 5 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
        );
      },
      onPanResponderGrant: () => {
        isSwipingDown.current = true;
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        isSwipingDown.current = false;
        if (gestureState.dy > DISMISS_THRESHOLD) {
          // Dismiss
          Animated.timing(translateY, {
            toValue: Dimensions.get('window').height,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            translateY.setValue(0);
            onClose();
          });
        } else {
          // Snap back
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 120,
            friction: 8,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        isSwipingDown.current = false;
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={handleClose}
    >
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: colors.night,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            opacity: fadeAnim,
            transform: [{ translateY }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Swipe indicator bar */}
        <View style={styles.swipeIndicatorContainer}>
          <View style={[styles.swipeIndicator, { backgroundColor: colors.rim }]} />
        </View>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.rim }]}>
          <View style={styles.headerText}>
            <Text
              style={[styles.title, { color: colors.ink }]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {subtitle != null && subtitle.length > 0 && (
              <Text
                style={[styles.subtitle, { color: colors.inkMid }]}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            )}
          </View>
          <Pressable
            onPress={handleClose}
            accessibilityLabel="Close chart"
            accessibilityRole="button"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={[
              styles.closeButton,
              { backgroundColor: colors.card, borderColor: colors.rim },
            ]}
          >
            <Text style={[styles.closeIcon, { color: colors.ink }]}>
              {'\u2715'}
            </Text>
          </Pressable>
        </View>

        {/* Chart area — measured via onLayout so charts adapt to orientation */}
        <View style={styles.chartArea} onLayout={onChartAreaLayout}>
          {chartLayout.height > 0
            ? (typeof children === 'function' ? children(chartLayout) : children)
            : null}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  swipeIndicatorContainer: {
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 2,
  },
  swipeIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerText: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 20,
    fontWeight: '700',
  },
  chartArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
});
