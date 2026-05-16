import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Webhook handler logic (isolated from Stripe SDK) ----
// We test the business logic of the handler without mocking the full Stripe SDK.

interface MockSession {
  id: string
  payment_status: string
  metadata?: Record<string, string>
  customer_details?: { email?: string; name?: string }
  amount_total?: number
}

interface WebhookResult {
  statusCode: number
  body: string
}

interface MockBlobStore {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string, options?: { ttl?: number }) => Promise<void>
}

// Simplified handler factory that accepts injected dependencies for testing
function makeWebhookHandler(deps: {
  constructEvent: (body: string, sig: string, secret: string) => { type: string; data: { object: MockSession } }
  sendConfirmationEmail: (session: MockSession) => Promise<void>
  logToSheets: (session: MockSession) => Promise<void>
  getStore?: () => MockBlobStore
}) {
  return async (event: { body: string; headers: Record<string, string> }): Promise<WebhookResult> => {
    const sig = event.headers['stripe-signature']

    let stripeEvent: { type: string; data: { object: MockSession } }
    try {
      stripeEvent = deps.constructEvent(event.body, sig, 'whsec_test')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown'
      console.error('Webhook signature verification failed:', msg)
      return { statusCode: 400, body: 'Webhook Error' }
    }

    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object

      if (session.payment_status === 'paid') {
        // Idempotency check — skip if we've already processed this session
        let store: MockBlobStore | null = null
        if (deps.getStore) {
          try {
            store = deps.getStore()
            const existing = await store.get(session.id)
            if (existing !== null) {
              console.log(`Duplicate webhook for session ${session.id}, skipping`)
              return { statusCode: 200, body: JSON.stringify({ received: true }) }
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'unknown'
            console.warn('Blob store unavailable for idempotency check, proceeding anyway:', msg)
            store = null
          }
        }

        try {
          await deps.sendConfirmationEmail(session)
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'unknown'
          console.error('Failed to send confirmation email:', msg)
        }

        try {
          await deps.logToSheets(session)
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'unknown'
          console.error('Failed to log to sheets:', msg)
        }

        // Mark session as processed (7-day TTL)
        if (store !== null) {
          try {
            await store.set(session.id, String(Date.now()), { ttl: 7 * 24 * 60 * 60 })
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'unknown'
            console.warn('Failed to mark session as processed in blob store:', msg)
          }
        }
      }
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) }
  }
}

// ---- Tests ----

describe('Webhook handler', () => {
  let sendConfirmationEmail: ReturnType<typeof vi.fn>
  let logToSheets: ReturnType<typeof vi.fn>

  beforeEach(() => {
    sendConfirmationEmail = vi.fn().mockResolvedValue(undefined)
    logToSheets = vi.fn().mockResolvedValue(undefined)
  })

  it('returns 400 when signature verification fails', async () => {
    const handler = makeWebhookHandler({
      constructEvent: () => { throw new Error('Invalid signature') },
      sendConfirmationEmail,
      logToSheets,
    })

    const result = await handler({
      body: '{}',
      headers: { 'stripe-signature': 'bad_sig' },
    })

    expect(result.statusCode).toBe(400)
    expect(result.body).toBe('Webhook Error')
    expect(sendConfirmationEmail).not.toHaveBeenCalled()
    expect(logToSheets).not.toHaveBeenCalled()
  })

  it('returns 200 and sends email + logs when payment_status is paid', async () => {
    const session: MockSession = {
      id: 'cs_test_abc123',
      payment_status: 'paid',
      metadata: { ordersSummary: '1x M' },
      customer_details: { email: 'test@example.com' },
      amount_total: 2500,
    }

    const handler = makeWebhookHandler({
      constructEvent: () => ({
        type: 'checkout.session.completed',
        data: { object: session },
      }),
      sendConfirmationEmail,
      logToSheets,
    })

    const result = await handler({
      body: JSON.stringify(session),
      headers: { 'stripe-signature': 'valid_sig' },
    })

    expect(result.statusCode).toBe(200)
    expect(JSON.parse(result.body)).toEqual({ received: true })
    expect(sendConfirmationEmail).toHaveBeenCalledOnce()
    expect(sendConfirmationEmail).toHaveBeenCalledWith(session)
    expect(logToSheets).toHaveBeenCalledOnce()
    expect(logToSheets).toHaveBeenCalledWith(session)
  })

  it('skips email and logging when payment_status is not paid', async () => {
    const session: MockSession = {
      id: 'cs_test_abc123',
      payment_status: 'unpaid',
      metadata: {},
      customer_details: { email: 'test@example.com' },
      amount_total: 2500,
    }

    const handler = makeWebhookHandler({
      constructEvent: () => ({
        type: 'checkout.session.completed',
        data: { object: session },
      }),
      sendConfirmationEmail,
      logToSheets,
    })

    const result = await handler({
      body: JSON.stringify(session),
      headers: { 'stripe-signature': 'valid_sig' },
    })

    expect(result.statusCode).toBe(200)
    expect(sendConfirmationEmail).not.toHaveBeenCalled()
    expect(logToSheets).not.toHaveBeenCalled()
  })

  it('still returns 200 when sendConfirmationEmail throws', async () => {
    sendConfirmationEmail.mockRejectedValue(new Error('SMTP error'))

    const session: MockSession = {
      id: 'cs_test_abc123',
      payment_status: 'paid',
      metadata: {},
      customer_details: { email: 'test@example.com' },
      amount_total: 2500,
    }

    const handler = makeWebhookHandler({
      constructEvent: () => ({
        type: 'checkout.session.completed',
        data: { object: session },
      }),
      sendConfirmationEmail,
      logToSheets,
    })

    const result = await handler({
      body: JSON.stringify(session),
      headers: { 'stripe-signature': 'valid_sig' },
    })

    // Must return 200 so Stripe does not retry the webhook
    expect(result.statusCode).toBe(200)
    expect(logToSheets).toHaveBeenCalledOnce()
  })
})

describe('Webhook handler — idempotency', () => {
  let sendConfirmationEmail: ReturnType<typeof vi.fn>
  let logToSheets: ReturnType<typeof vi.fn>
  let blobStore: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> }

  const session: MockSession = {
    id: 'cs_test_idem_001',
    payment_status: 'paid',
    metadata: { ordersSummary: '1x L' },
    customer_details: { email: 'buyer@example.com' },
    amount_total: 5000,
  }

  const makeEvent = () => ({
    body: JSON.stringify(session),
    headers: { 'stripe-signature': 'valid_sig' },
  })

  const constructEvent = () => ({
    type: 'checkout.session.completed',
    data: { object: session },
  })

  beforeEach(() => {
    sendConfirmationEmail = vi.fn().mockResolvedValue(undefined)
    logToSheets = vi.fn().mockResolvedValue(undefined)
    blobStore = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
    }
  })

  it('processes the event and marks it in the blob store on first delivery', async () => {
    blobStore.get.mockResolvedValue(null) // not seen before

    const handler = makeWebhookHandler({
      constructEvent,
      sendConfirmationEmail,
      logToSheets,
      getStore: () => blobStore,
    })

    const result = await handler(makeEvent())

    expect(result.statusCode).toBe(200)
    expect(sendConfirmationEmail).toHaveBeenCalledOnce()
    expect(logToSheets).toHaveBeenCalledOnce()
    expect(blobStore.set).toHaveBeenCalledOnce()
    expect(blobStore.set).toHaveBeenCalledWith(
      session.id,
      expect.any(String),
      { ttl: 7 * 24 * 60 * 60 },
    )
  })

  it('returns 200 without calling sendConfirmationEmail on duplicate delivery', async () => {
    blobStore.get.mockResolvedValue('1700000000000') // already processed

    const handler = makeWebhookHandler({
      constructEvent,
      sendConfirmationEmail,
      logToSheets,
      getStore: () => blobStore,
    })

    const result = await handler(makeEvent())

    expect(result.statusCode).toBe(200)
    expect(sendConfirmationEmail).not.toHaveBeenCalled()
    expect(logToSheets).not.toHaveBeenCalled()
    expect(blobStore.set).not.toHaveBeenCalled()
  })

  it('proceeds with order processing when blob store throws', async () => {
    blobStore.get.mockRejectedValue(new Error('blob store unavailable'))

    const handler = makeWebhookHandler({
      constructEvent,
      sendConfirmationEmail,
      logToSheets,
      getStore: () => blobStore,
    })

    const result = await handler(makeEvent())

    expect(result.statusCode).toBe(200)
    // Email and sheets must still be called even when blob store is down
    expect(sendConfirmationEmail).toHaveBeenCalledOnce()
    expect(logToSheets).toHaveBeenCalledOnce()
  })
})
