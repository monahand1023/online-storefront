/**
 * Unit tests for get-session Netlify function logic.
 *
 * The actual handler (get-session.js) instantiates Stripe at module scope,
 * so we use a factory pattern here that accepts a mock Stripe client,
 * mirroring the exact handler logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Handler factory
// ---------------------------------------------------------------------------

interface MockStripe {
  checkout: {
    sessions: {
      retrieve: ReturnType<typeof vi.fn>
    }
  }
}

function makeGetSessionHandler(stripe: MockStripe) {
  return async (event: {
    httpMethod: string
    queryStringParameters?: Record<string, string | undefined> | null
  }) => {
    if (event.httpMethod !== 'GET') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
    }

    const params = event.queryStringParameters ?? {}
    const sessionId = params.sessionId ?? params.session_id

    if (!sessionId || !sessionId.startsWith('cs_') || sessionId.length <= 10) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid or missing session ID' }) }
    }

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['customer_details', 'line_items'],
      })

      return {
        statusCode: 200,
        body: JSON.stringify({
          customer_details: session.customer_details,
          amount_total: session.amount_total,
          payment_status: session.payment_status,
          metadata: session.metadata,
          line_items: session.line_items,
        }),
      }
    } catch (error: unknown) {
      return { statusCode: 500, body: JSON.stringify({ error: 'An internal error occurred. Please try again.' }) }
    }
  }
}

// ---------------------------------------------------------------------------
// Mock Stripe session fixture
// ---------------------------------------------------------------------------

const mockSession = {
  customer_details: { email: 'buyer@example.com', name: 'Jane Doe' },
  amount_total: 2500,
  payment_status: 'paid',
  metadata: {
    ordersSummary: '1x M',
    studentGrade: '3',
    program: 'Japanese',
    pickupName: 'Jane Doe',
    pickupDate: '2/15',
    discountApplied: 'false',
    original_amount_cents: '2500',
  },
  line_items: { data: [] },
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('get-session handler — input validation', () => {
  let mockRetrieve: ReturnType<typeof vi.fn>
  let mockStripe: MockStripe

  beforeEach(() => {
    mockRetrieve = vi.fn().mockResolvedValue(mockSession)
    mockStripe = { checkout: { sessions: { retrieve: mockRetrieve } } }
  })

  it('returns 400 when session_id is missing', async () => {
    const handler = makeGetSessionHandler(mockStripe)
    const result = await handler({ httpMethod: 'GET', queryStringParameters: {} })
    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).error).toContain('Invalid or missing')
    expect(mockRetrieve).not.toHaveBeenCalled()
  })

  it('returns 400 when session_id is null/undefined', async () => {
    const handler = makeGetSessionHandler(mockStripe)
    const result = await handler({ httpMethod: 'GET', queryStringParameters: null })
    expect(result.statusCode).toBe(400)
  })

  it('returns 400 when session_id does not start with "cs_"', async () => {
    const handler = makeGetSessionHandler(mockStripe)
    const result = await handler({
      httpMethod: 'GET',
      queryStringParameters: { session_id: 'pi_test_abc123456789' },
    })
    expect(result.statusCode).toBe(400)
    expect(mockRetrieve).not.toHaveBeenCalled()
  })

  it('returns 400 when session_id is too short (≤ 10 chars)', async () => {
    const handler = makeGetSessionHandler(mockStripe)
    const result = await handler({
      httpMethod: 'GET',
      queryStringParameters: { session_id: 'cs_short' }, // 8 chars
    })
    expect(result.statusCode).toBe(400)
  })

  it('returns 400 for an empty session_id string', async () => {
    const handler = makeGetSessionHandler(mockStripe)
    const result = await handler({
      httpMethod: 'GET',
      queryStringParameters: { session_id: '' },
    })
    expect(result.statusCode).toBe(400)
  })

  it('returns 405 for non-GET requests', async () => {
    const handler = makeGetSessionHandler(mockStripe)
    const result = await handler({
      httpMethod: 'POST',
      queryStringParameters: { session_id: 'cs_test_abc1234567890' },
    })
    expect(result.statusCode).toBe(405)
    expect(mockRetrieve).not.toHaveBeenCalled()
  })
})

describe('get-session handler — successful Stripe call', () => {
  let mockRetrieve: ReturnType<typeof vi.fn>
  let mockStripe: MockStripe

  beforeEach(() => {
    mockRetrieve = vi.fn().mockResolvedValue(mockSession)
    mockStripe = { checkout: { sessions: { retrieve: mockRetrieve } } }
  })

  it('calls stripe.checkout.sessions.retrieve with the correct sessionId', async () => {
    const handler = makeGetSessionHandler(mockStripe)
    const SESSION_ID = 'cs_test_abc1234567890'
    await handler({ httpMethod: 'GET', queryStringParameters: { session_id: SESSION_ID } })

    expect(mockRetrieve).toHaveBeenCalledOnce()
    expect(mockRetrieve).toHaveBeenCalledWith(SESSION_ID, {
      expand: ['customer_details', 'line_items'],
    })
  })

  it('returns 200 with session data for a valid cs_test_ session ID', async () => {
    const handler = makeGetSessionHandler(mockStripe)
    const result = await handler({
      httpMethod: 'GET',
      queryStringParameters: { session_id: 'cs_test_abc1234567890' },
    })

    expect(result.statusCode).toBe(200)
    const body = JSON.parse(result.body)
    expect(body.amount_total).toBe(2500)
    expect(body.payment_status).toBe('paid')
    expect(body.customer_details.email).toBe('buyer@example.com')
    expect(body.metadata.ordersSummary).toBe('1x M')
  })

  it('returns 200 for a valid cs_ (live mode) session ID', async () => {
    const handler = makeGetSessionHandler(mockStripe)
    const result = await handler({
      httpMethod: 'GET',
      queryStringParameters: { session_id: 'cs_live_xyz987654321xx' },
    })
    expect(result.statusCode).toBe(200)
  })

  it('also accepts sessionId (camelCase) query param', async () => {
    const handler = makeGetSessionHandler(mockStripe)
    const result = await handler({
      httpMethod: 'GET',
      queryStringParameters: { sessionId: 'cs_test_camel123456789' },
    })
    expect(result.statusCode).toBe(200)
  })
})

describe('get-session handler — Stripe error', () => {
  it('returns 500 when Stripe throws', async () => {
    const mockRetrieve = vi.fn().mockRejectedValue(new Error('No such session'))
    const mockStripe: MockStripe = { checkout: { sessions: { retrieve: mockRetrieve } } }

    const handler = makeGetSessionHandler(mockStripe)
    const result = await handler({
      httpMethod: 'GET',
      queryStringParameters: { session_id: 'cs_test_abc1234567890' },
    })

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body).error).toContain('internal error')
  })
})
