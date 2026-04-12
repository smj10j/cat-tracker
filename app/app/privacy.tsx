import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-night" edges={['top']}>
      <View className="px-4 py-3 flex-row items-center gap-3 border-b border-rim">
        <Pressable onPress={() => router.back()}>
          <Text className="text-lavender text-base">← Back</Text>
        </Pressable>
        <Text className="text-ink text-xl font-bold">Privacy Policy</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-6" contentContainerStyle={{ gap: 24 }}>
        <Text className="text-ink text-2xl font-bold">Whisker Health — Privacy Policy</Text>
        <Text className="text-ink-mid text-sm">Last updated: April 10, 2026</Text>

        <Section title="1. What Data We Collect">
          <Bullet text="Email address and display name (from Google or Apple sign-in)" />
          <Bullet text="Cat health measurements: weight, food intake, water intake, grooming, activity, litter, vomiting observations" />
          <Bullet text="Cat profile information: name, birthdate, breed, sex, microchip ID, photos" />
          <Bullet text="Medication and care schedules" />
          <Bullet text="Push notification device tokens (iOS/Android)" />
        </Section>

        <Section title="2. How Your Data Is Stored">
          <Text className="text-ink-mid text-sm leading-relaxed">
            All data is stored on Cloudflare's global network using Cloudflare D1 (database) and R2 (photos).
            Cloudflare processes and caches data across multiple jurisdictions worldwide, including the European Union.
            Your data is encrypted in transit (TLS) and at rest.
          </Text>
        </Section>

        <Section title="3. Who Has Access">
          <Text className="text-ink-mid text-sm leading-relaxed">
            Your data is accessible only to you and members of your household who you have invited.
            Household members see shared cats and measurements based on their assigned role
            (Viewer, Contributor, Editor, or Admin).
          </Text>
        </Section>

        <Section title="4. Third-Party Services">
          <Bullet text="Google OAuth — for sign-in authentication" />
          <Bullet text="Apple OAuth — for Sign in with Apple" />
          <Bullet text="Resend (resend.com) — for sending household invitation emails from noreply@01j.me" />
          <Bullet text="Expo Push Notification Service — for delivering medication reminders to your device" />
          <Text className="text-ink-mid text-sm mt-2 leading-relaxed">
            We do not use analytics SDKs, advertising identifiers, or tracking pixels.
            We do not sell or share your data with any third party for advertising or marketing purposes.
          </Text>
        </Section>

        <Section title="5. Data Retention and Deletion">
          <Text className="text-ink-mid text-sm leading-relaxed">
            You can delete individual cats and their measurements at any time from the app.
            You can delete your entire account from Settings → Delete Account. This permanently
            removes all your data including cats, measurements, medications, photos, sessions,
            and household memberships. Account deletion is immediate and irreversible.
          </Text>
        </Section>

        <Section title="6. Your Rights">
          <Text className="text-ink-mid text-sm leading-relaxed">
            You have the right to access, export, and delete your personal data at any time.
            Use the "Download My Data" option in Settings to export all your data as JSON.
            Under the GDPR (Articles 15–20) and CCPA, you have additional rights including
            data portability, erasure, and the right to opt out of data sales (we do not sell data).
          </Text>
        </Section>

        <Section title="7. Contact">
          <Text className="text-ink-mid text-sm leading-relaxed">
            For privacy inquiries, contact us at privacy@01j.me.
          </Text>
        </Section>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-ink text-lg font-semibold">{title}</Text>
      {children}
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View className="flex-row gap-2 pl-2">
      <Text className="text-ink-dim text-sm">•</Text>
      <Text className="text-ink-mid text-sm flex-1 leading-relaxed">{text}</Text>
    </View>
  );
}
