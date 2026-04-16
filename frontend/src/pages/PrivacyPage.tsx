export default function PrivacyPage() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--color-bg)',
      color: 'var(--color-ink)',
      padding: '48px 24px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      lineHeight: 1.7,
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
          Whisker Health — Privacy Policy
        </h1>
        <p style={{ color: 'var(--color-ink-mid)', fontSize: 14, marginBottom: 32 }}>
          Last updated: April 10, 2026
        </p>

        <Section title="1. What Data We Collect">
          <ul style={{ paddingLeft: 20 }}>
            <li>Email address and display name (from Google or Apple sign-in)</li>
            <li>Cat health measurements: weight, food intake, water intake, grooming, activity, litter, vomiting observations</li>
            <li>Cat profile information: name, birthdate, breed, sex, microchip ID, photos</li>
            <li>Medication and care schedules</li>
            <li>Push notification device tokens (iOS/Android)</li>
          </ul>
        </Section>

        <Section title="2. How Your Data Is Stored">
          <p>
            All data is stored on Cloudflare's global network using Cloudflare D1 (database) and
            R2 (photos). Cloudflare processes and caches data across multiple jurisdictions worldwide,
            including the European Union. Your data is encrypted in transit (TLS) and at rest.
          </p>
        </Section>

        <Section title="3. Who Has Access">
          <p>
            Your data is accessible only to you and members of your household who you have invited.
            Household members see shared cats and measurements based on their assigned role
            (Viewer, Contributor, Editor, or Admin).
          </p>
        </Section>

        <Section title="4. Third-Party Services">
          <ul style={{ paddingLeft: 20 }}>
            <li><strong>Google OAuth</strong> — for sign-in authentication</li>
            <li><strong>Apple OAuth</strong> — for Sign in with Apple</li>
            <li><strong>Resend</strong> (resend.com) — for sending household invitation emails from noreply@01j.me</li>
            <li><strong>Expo Push Notification Service</strong> — for delivering medication reminders to your device</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            We do not use analytics SDKs, advertising identifiers, or tracking pixels.
            We do not sell or share your data with any third party for advertising or marketing purposes.
          </p>
        </Section>

        <Section title="5. Data Retention and Deletion">
          <p>
            You can delete individual cats and their measurements at any time from the app.
            You can delete your entire account from Settings → Delete Account. This permanently
            removes all your data including cats, measurements, medications, photos, sessions,
            and household memberships. Account deletion is immediate and irreversible.
          </p>
        </Section>

        <Section title="6. Your Rights">
          <p>
            You have the right to access, export, and delete your personal data at any time.
            Use the "Download My Data" option in Settings to export all your data as JSON.
            Under the GDPR (Articles 15–20) and CCPA, you have additional rights including
            data portability, erasure, and the right to opt out of data sales (we do not sell data).
          </p>
        </Section>

        <Section title="7. Contact">
          <p>
            For privacy inquiries, contact us at{' '}
            <a href="mailto:privacy@01j.me" style={{ color: 'var(--color-brand)' }}>privacy@01j.me</a>.
          </p>
        </Section>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--color-rim)', color: 'var(--color-ink-dim)', fontSize: 13, textAlign: 'center' }}>
          © 2026 Whisker Health. All rights reserved.
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--color-ink)' }}>{title}</h2>
      <div style={{ color: 'var(--color-ink-mid)', fontSize: 15 }}>{children}</div>
    </section>
  )
}
