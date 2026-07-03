/**
 * Expo Push API helper.
 *
 * Sends push notifications via Expo's HTTP push service.
 * No SDK or access token needed for basic usage (<600 notifications/min).
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const BATCH_SIZE = 100 // Expo limit per request

export interface ExpoPushMessage {
  to: string            // ExponentPushToken[...]
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default' | null
  badge?: number
  categoryId?: string   // maps to APNs category → actionable lock-screen buttons (WP4g)
}

export interface ExpoPushTicket {
  status: 'ok' | 'error'
  id?: string
  message?: string
  details?: { error?: string }
}

/**
 * Send push notifications via Expo Push API.
 * Batches messages in chunks of 100 (Expo limit per request).
 * Returns all tickets for error handling.
 */
export async function sendExpoPushNotifications(
  messages: ExpoPushMessage[],
): Promise<ExpoPushTicket[]> {
  if (messages.length === 0) return []

  const allTickets: ExpoPushTicket[] = []

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE)
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(batch),
      })

      if (!response.ok) {
        console.error(`Expo Push API returned ${response.status}: ${await response.text()}`)
        // Return error tickets for each message in this batch
        allTickets.push(...batch.map(() => ({
          status: 'error' as const,
          message: `HTTP ${response.status}`,
        })))
        continue
      }

      const result = await response.json() as { data: ExpoPushTicket[] }
      allTickets.push(...(result.data ?? []))
    } catch (err) {
      console.error('Expo Push API fetch failed:', err)
      allTickets.push(...batch.map(() => ({
        status: 'error' as const,
        message: 'Network error',
      })))
    }
  }

  return allTickets
}

/**
 * Extract token strings from tickets that indicate the device is no longer registered.
 * These tokens should be deleted from the database.
 */
export function getStaleTokens(
  messages: ExpoPushMessage[],
  tickets: ExpoPushTicket[],
): string[] {
  const stale: string[] = []
  for (let i = 0; i < tickets.length && i < messages.length; i++) {
    const ticket = tickets[i]!
    if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
      stale.push(messages[i]!.to)
    }
  }
  return stale
}
