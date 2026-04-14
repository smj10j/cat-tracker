import { View, Text, Pressable } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../hooks/useThemeColors';

const TABS = [
  { href: '/', icon: '\uD83D\uDC31', label: 'Cats' },
  { href: '/log', icon: '\uD83D\uDCDD', label: 'Log' },
  { href: '/compare', icon: '\uD83D\uDCCA', label: 'Compare' },
] as const;

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  function isActive(href: string): boolean {
    if (href === '/') {
      // Home tab: active for /, /cats/*, but not /compare or /log
      return pathname === '/' || pathname === '/index' || pathname.startsWith('/cats');
    }
    return pathname.startsWith(href);
  }

  return (
    <View
      style={{
        backgroundColor: colors.night,
        borderTopWidth: 1,
        borderTopColor: colors.rim,
        paddingBottom: insets.bottom,
        paddingTop: 8,
      }}
    >
      <View style={{ flexDirection: 'row', maxWidth: 500, width: '100%', alignSelf: 'center' }}>
      {TABS.map((tab) => {
        const active = isActive(tab.href);
        return (
          <Pressable
            key={tab.href}
            onPress={() => router.push(tab.href as never)}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 4,
            }}
          >
            <Text style={{ fontSize: 20, color: active ? colors.lavender : colors.inkDim }}>
              {tab.icon}
            </Text>
            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                marginTop: 2,
                color: active ? colors.lavender : colors.inkDim,
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
      </View>
    </View>
  );
}
