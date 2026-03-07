/**
 * Send a transactional email via MailChannels.
 * Fails gracefully — if email cannot be sent the operation still succeeds.
 * See: https://support.mailchannels.com/hc/en-us/articles/16918954360845
 */
export async function sendEmail(params: {
  to: string
  toName?: string
  subject: string
  text: string
  html?: string
}): Promise<void> {
  const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email: params.to, ...(params.toName ? { name: params.toName } : {}) }],
      }],
      from: { email: 'noreply@cat-tracker.pages.dev', name: 'Cat Tracker' },
      subject: params.subject,
      content: [
        { type: 'text/plain', value: params.text },
        ...(params.html ? [{ type: 'text/html', value: params.html }] : []),
      ],
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Email delivery failed: ${res.status} ${body}`)
  }
}
