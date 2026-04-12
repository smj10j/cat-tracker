import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendExpoPushNotifications, getStaleTokens, type ExpoPushMessage, type ExpoPushTicket } from '../../lib/push'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('sendExpoPushNotifications', () => {
  it('returns empty array for no messages', async () => {
    const result = await sendExpoPushNotifications([])
    expect(result).toEqual([])
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('sends a single batch to Expo Push API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ status: 'ok', id: 'ticket-1' }],
      }),
    })

    const messages: ExpoPushMessage[] = [
      { to: 'ExponentPushToken[abc123]', title: 'Test', body: 'Hello' },
    ]

    const tickets = await sendExpoPushNotifications(messages)
    expect(tickets).toHaveLength(1)
    expect(tickets[0]!.status).toBe('ok')

    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockFetch).toHaveBeenCalledWith(
      'https://exp.host/--/api/v2/push/send',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      }),
    )
  })

  it('batches messages in chunks of 100', async () => {
    // First batch: 100 messages → 100 tickets
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: Array(100).fill({ status: 'ok' }) }),
    })
    // Second batch: 50 messages → 50 tickets
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: Array(50).fill({ status: 'ok' }) }),
    })

    const messages: ExpoPushMessage[] = Array.from({ length: 150 }, (_, i) => ({
      to: `ExponentPushToken[token-${i}]`,
      title: 'Test',
      body: 'Hello',
    }))

    const tickets = await sendExpoPushNotifications(messages)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(tickets).toHaveLength(150)
  })

  it('handles HTTP error gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    })

    const messages: ExpoPushMessage[] = [
      { to: 'ExponentPushToken[abc]', title: 'Test', body: 'Hello' },
    ]

    const tickets = await sendExpoPushNotifications(messages)
    expect(tickets).toHaveLength(1)
    expect(tickets[0]!.status).toBe('error')
  })

  it('handles network error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const messages: ExpoPushMessage[] = [
      { to: 'ExponentPushToken[abc]', title: 'Test', body: 'Hello' },
    ]

    const tickets = await sendExpoPushNotifications(messages)
    expect(tickets).toHaveLength(1)
    expect(tickets[0]!.status).toBe('error')
  })
})

describe('getStaleTokens', () => {
  it('returns empty array when no DeviceNotRegistered errors', () => {
    const messages: ExpoPushMessage[] = [
      { to: 'ExponentPushToken[abc]', title: 'T', body: 'B' },
    ]
    const tickets: ExpoPushTicket[] = [{ status: 'ok', id: 'ticket-1' }]

    expect(getStaleTokens(messages, tickets)).toEqual([])
  })

  it('returns tokens for DeviceNotRegistered errors', () => {
    const messages: ExpoPushMessage[] = [
      { to: 'ExponentPushToken[abc]', title: 'T', body: 'B' },
      { to: 'ExponentPushToken[def]', title: 'T', body: 'B' },
      { to: 'ExponentPushToken[ghi]', title: 'T', body: 'B' },
    ]
    const tickets: ExpoPushTicket[] = [
      { status: 'ok', id: 'ticket-1' },
      { status: 'error', message: 'bad', details: { error: 'DeviceNotRegistered' } },
      { status: 'ok', id: 'ticket-3' },
    ]

    const stale = getStaleTokens(messages, tickets)
    expect(stale).toEqual(['ExponentPushToken[def]'])
  })
})
