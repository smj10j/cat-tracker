import { useState } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Text, View, ActivityIndicator } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import QuickAdd from '../../components/QuickAdd';

export default function TabLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const colors = useThemeColors();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.night, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.lavender} size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.night,
            borderTopColor: colors.rim,
          },
          tabBarActiveTintColor: colors.lavender,
          tabBarInactiveTintColor: colors.inkDim,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Cats',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>{'\uD83D\uDC31'}</Text>,
          }}
        />
        <Tabs.Screen
          name="log"
          options={{
            title: 'Log',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>{'\uD83D\uDCDD'}</Text>,
          }}
        />
        <Tabs.Screen
          name="compare"
          options={{
            title: 'Compare',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>{'\uD83D\uDCCA'}</Text>,
          }}
        />
      </Tabs>
      <QuickAdd open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </>
  );
}
