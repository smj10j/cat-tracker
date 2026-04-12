import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '../hooks/useThemeColors';

interface FullScreenChartModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function FullScreenChartModal({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: FullScreenChartModalProps) {
  const colors = useThemeColors();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.night }]}
        edges={['top', 'bottom']}
      >
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
            onPress={onClose}
            accessibilityLabel="Close chart"
            accessibilityRole="button"
            style={[
              styles.closeButton,
              { backgroundColor: colors.card, borderColor: colors.rim },
            ]}
          >
            <Text style={[styles.closeIcon, { color: colors.inkMid }]}>
              &#x2715;
            </Text>
          </Pressable>
        </View>

        {/* Chart area */}
        <View style={styles.chartArea}>{children}</View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    fontSize: 18,
    fontWeight: '600',
  },
  chartArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
});
