import { View, Text, ScrollView, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useThemeColors } from '../hooks/useThemeColors';

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
  const colors = useThemeColors();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.night }}>
      <View style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.rim,
      }}>
        <Pressable
          onPress={() => router.back()}
          style={{ paddingVertical: 8, paddingRight: 8 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ color: colors.lavender, fontSize: 15, fontWeight: '600' }}>{'\u2190'} Back</Text>
        </Pressable>
        <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '700' }}>Wellness Guide</Text>
      </View>

      <ScrollView
        style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}
        contentContainerStyle={{ gap: 16, paddingBottom: 32 }}
      >
        <Text style={{ color: colors.inkMid, fontSize: 14, lineHeight: 20 }}>
          This guide summarizes key indicators for monitoring your cat's health.
          All thresholds are sourced from AAFP, WSAVA, and ISFM veterinary guidelines.
        </Text>

        {GUIDE_SECTIONS.map((section) => (
          <View
            key={section.title}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.rim,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Text style={{ fontSize: 20 }}>{section.emoji}</Text>
              <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 16 }}>{section.title}</Text>
            </View>
            <Text style={{ color: colors.inkMid, fontSize: 14, lineHeight: 20 }}>{section.content}</Text>
          </View>
        ))}

        <View style={{
          backgroundColor: colors.surfaceHi,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.rim,
          marginTop: 8,
        }}>
          <Text style={{ color: colors.inkDim, fontSize: 12, lineHeight: 18, textAlign: 'center' }}>
            Health thresholds sourced from AAFP (American Association of Feline Practitioners),
            WSAVA (World Small Animal Veterinary Association), and ISFM (International Society
            of Feline Medicine).{' '}
            <Text
              style={{ color: colors.lavender, textDecorationLine: 'underline' }}
              onPress={() => Linking.openURL('https://github.com/smj10j/cat-tracker/tree/main/docs/research')}
            >
              Full citations and sources
            </Text>.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
