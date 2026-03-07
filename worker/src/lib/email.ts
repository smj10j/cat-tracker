/**
 * Send a transactional email via Resend (https://resend.com).
 * Requires RESEND_API_KEY Worker secret.
 *
 * From address: use a verified Resend domain. For testing, Resend allows
 * 'onboarding@resend.dev' before domain verification.
 */
export async function sendEmail(params: {
  to: string
  toName?: string
  subject: string
  text: string
  html?: string
}, apiKey: string): Promise<void> {
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: 'Cat Tracker <noreply@01j.me>',
      to: params.toName ? [`${params.toName} <${params.to}>`] : [params.to],
      subject: params.subject,
      text: params.text,
      ...(params.html ? { html: params.html } : {}),
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Email delivery failed: ${res.status} ${body}`)
  }
}
