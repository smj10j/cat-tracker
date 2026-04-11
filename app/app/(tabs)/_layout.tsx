import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#16111f',
          borderTopColor: 'rgba(255,255,255,0.07)',
        },
        tabBarActiveTintColor: '#c084fc',
        tabBarInactiveTintColor: '#6b5f85',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Cats',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🐱</Text>,
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Log',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📝</Text>,
        }}
      />
      <Tabs.Screen
        name="compare"
        options={{
          title: 'Compare',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📊</Text>,
        }}
      />
    </Tabs>
  );
}
