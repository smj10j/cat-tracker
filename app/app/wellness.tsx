import { View, Text, ScrollView, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const GUIDE_SECTIONS = [
  {
    title: 'Weight Monitoring',
    emoji: '⚖️',
    content: 'Weigh your cat weekly at the same time. A change of more than 5% in a month warrants a vet visit. Sudden loss can indicate serious conditions like hepatic lipidosis.',
  },
  {
    title: 'Food & Water Intake',
    emoji: '🍽️',
    content: 'Track daily food consumption and water intake. Decreased appetite lasting more than 24 hours is a concern. Increased thirst can signal kidney disease or diabetes.',
  },
  {
    title: 'Litter Box Habits',
    emoji: '🚽',
    content: 'Monitor frequency, consistency, and any straining. Urinary straining is an emergency — seek veterinary care immediately.',
  },
  {
    title: 'Grooming Behavior',
    emoji: '🛁',
    content: 'Over-grooming (bald patches) may indicate stress or skin conditions. Under-grooming (matted fur) often signals pain or illness.',
  },
  {
    title: 'Activity Level',
    emoji: '🏃',
    content: 'Decreased activity can be an early sign of pain, illness, or aging-related conditions. Track changes over weeks, not days.',
  },
  {
    title: 'Vomiting',
    emoji: '🤢',
    content: 'Occasional hairballs are normal. Frequent vomiting (more than twice weekly) warrants investigation. Note timing relative to meals.',
  },
];

export default function WellnessGuideScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-night">
      <View className="px-4 py-3 flex-row items-center gap-3 border-b border-rim">
        <Pressable onPress={() => router.back()}>
          <Text className="text-lavender text-base">← Back</Text>
        </Pressable>
        <Text className="text-ink text-xl font-bold">Wellness Guide</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ gap: 16 }}>
        <Text className="text-ink-mid text-sm leading-relaxed">
          This guide summarizes key indicators for monitoring your cat's health.
          All thresholds are sourced from AAFP, WSAVA, and ISFM veterinary guidelines.
        </Text>

        {GUIDE_SECTIONS.map((section) => (
          <View key={section.title} className="bg-surface rounded-card p-4 border border-rim">
            <View className="flex-row items-center gap-2 mb-2">
              <Text className="text-xl">{section.emoji}</Text>
              <Text className="text-ink font-semibold text-base">{section.title}</Text>
            </View>
            <Text className="text-ink-mid text-sm leading-relaxed">{section.content}</Text>
          </View>
        ))}

        <View className="bg-surface-hi rounded-card p-4 border border-rim mt-4">
          <Text className="text-ink-dim text-xs leading-relaxed text-center">
            Health thresholds sourced from AAFP (American Association of Feline Practitioners),
            WSAVA (World Small Animal Veterinary Association), and ISFM (International Society
            of Feline Medicine).{' '}
            <Text
              style={{ color: '#c084fc', textDecorationLine: 'underline' }}
              onPress={() => Linking.openURL('https://github.com/smj10j/cat-tracker/tree/main/docs/research')}
            >
              Full citations and sources
            </Text>.
          </Text>
        </View>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
