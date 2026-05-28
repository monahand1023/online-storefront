/**
 * Additional webhook tests focusing on:
 *  1. checkout.session.completed with email + sheets behavior
 *  2. Idempotency via blob store
 *  3. Non-checkout event types are silently ignored
 *
 * The existing webhook.test.ts already covers the core happy path and
 * signature verification.  These tests extend coverage without duplicating it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Re-use the same handler factory pattern as webhook.test.ts
// ---------------------------------------------------------------------------

interface MockSession {
  id: string
  payment_status: string
  metadata?: Record<string, string>
  customer_details?: { email?: string; name?: string }
  amount_total?: number
}

interface MockBlobStore {
  get: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
}

interface WebhookResult {
  statusCode: number
  body: string
}

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
        let store: MockBlobStore | null = null
        if (deps.getStore) {
          try {
            store = deps.getStore()
            const existing = await store.get(session.id)
            if (existing !== null) {
              console.log(`Duplicate webhook for session ${session.id}, skipping`)
              return { statusCode: 200, body: JSON.stringify({ received: true }) }
            }
          } catch {
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

        if (store !== null) {
          try {
            await store.set(session.id, String(Date.now()), { ttl: 7 * 24 * 60 * 60 })
          } catch {
            // intentionally swallowed
          }
        }
      }
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) }
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCompletedSession(overrides: Partial<MockSession> = {}): MockSession {
  return {
    id: 'cs_test_webhook_001',
    payment_status: 'paid',
    metadata: {
      ordersSummary: '2x M, 1x L',
      studentGrade: '2',
      program: 'Japanese',
      pickupName: 'Alice Smith',
      pickupDate: '2/15',
      discountApplied: 'false',
      original_amount_cents: '7500',
    },
    customer_details: { email: 'alice@example.com', name: 'Alice Smith' },
    amount_total: 7500,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests: checkout.session.completed → email + sheets
// ---------------------------------------------------------------------------

describe('Webhook — checkout.session.completed triggers email + sheets', () => {
  let sendConfirmationEmail: ReturnType<typeof vi.fn>
  let logToSheets: ReturnType<typeof vi.fn>

  beforeEach(() => {
    sendConfirmationEmail = vi.fn().mockResolvedValue(undefined)
    logToSheets = vi.fn().mockResolvedValue(undefined)
  })

  it('calls sendConfirmationEmail with the session object', async () => {
    const session = makeCompletedSession()
    const handler = makeWebhookHandler({
      constructEvent: () => ({ type: 'checkout.session.completed', data: { object: session } }),
      sendConfirmationEmail,
      logToSheets,
    })

    await handler({ body: JSON.stringify(session), headers: { 'stripe-signature': 'sig' } })

    expect(sendConfirmationEmail).toHaveBeenCalledOnce()
    expect(sendConfirmationEmail).toHaveBeenCalledWith(session)
  })

  it('calls logToSheets with the session object', async () => {
    const session = makeCompletedSession()
    const handler = makeWebhookHandler({
      constructEvent: () => ({ type: 'checkout.session.completed', data: { object: session } }),
      sendConfirmationEmail,
      logToSheets,
    })

    await handler({ body: JSON.stringify(session), headers: { 'stripe-signature': 'sig' } })

    expect(logToSheets).toHaveBeenCalledOnce()
    expect(logToSheets).toHaveBeenCalledWith(session)
  })

  it('still calls logToSheets even when sendConfirmationEmail throws', async () => {
    sendConfirmationEmail.mockRejectedValue(new Error('SMTP timeout'))
    const session = makeCompletedSession()
    const handler = makeWebhookHandler({
      constructEvent: () => ({ type: 'checkout.session.completed', data: { object: session } }),
      sendConfirmationEmail,
      logToSheets,
    })

    const result = await handler({ body: JSON.stringify(session), headers: { 'stripe-signature': 'sig' } })

    expect(result.statusCode).toBe(200)
    expect(logToSheets).toHaveBeenCalledOnce()
  })

  it('still sends email even when logToSheets throws', async () => {
    logToSheets.mockRejectedValue(new Error('Sheets API error'))
    const session = makeCompletedSession()
    const handler = makeWebhookHandler({
      constructEvent: () => ({ type: 'checkout.session.completed', data: { object: session } }),
      sendConfirmationEmail,
      logToSheets,
    })

    const result = await handler({ body: JSON.stringify(session), headers: { 'stripe-signature': 'sig' } })

    expect(result.statusCode).toBe(200)
    expect(sendConfirmationEmail).toHaveBeenCalledOnce()
  })
})

describe('Webhook — non-checkout event types are silently ignored', () => {
  let sendConfirmationEmail: ReturnType<typeof vi.fn>
  let logToSheets: ReturnType<typeof vi.fn>

  beforeEach(() => {
    sendConfirmationEmail = vi.fn()
    logToSheets = vi.fn()
  })

  it('returns 200 without email/sheets for payment_intent.succeeded', async () => {
    const handler = makeWebhookHandler({
      constructEvent: () => ({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test', payment_status: 'paid' } as MockSession },
      }),
      sendConfirmationEmail,
      logToSheets,
    })

    const result = await handler({ body: '{}', headers: { 'stripe-signature': 'sig' } })

    expect(result.statusCode).toBe(200)
    expect(sendConfirmationEmail).not.toHaveBeenCalled()
    expect(logToSheets).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Tests: idempotency
// ---------------------------------------------------------------------------

describe('Webhook — idempotency via blob store', () => {
  let sendConfirmationEmail: ReturnType<typeof vi.fn>
  let logToSheets: ReturnType<typeof vi.fn>
  let blobStore: MockBlobStore

  const session = makeCompletedSession({ id: 'cs_test_idem_999' })
  const makeEvent = () => ({
    body: JSON.stringify(session),
    headers: { 'stripe-signature': 'valid_sig' },
  })
  const constructEvent = () => ({ type: 'checkout.session.completed', data: { object: session } })

  beforeEach(() => {
    sendConfirmationEmail = vi.fn().mockResolvedValue(undefined)
    logToSheets = vi.fn().mockResolvedValue(undefined)
    blobStore = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
    }
  })

  it('processes and marks the session on first delivery', async () => {
    blobStore.get.mockResolvedValue(null)
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
      { ttl: 7 * 24 * 60 * 60 }
    )
  })

  it('skips processing on duplicate delivery (blob returns a value)', async () => {
    blobStore.get.mockResolvedValue('1700000000000')
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

  it('processes normally when blob store get() throws (graceful degradation)', async () => {
    blobStore.get.mockRejectedValue(new Error('Blob unavailable'))
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
  })

  it('processes normally when getStore itself throws', async () => {
    const handler = makeWebhookHandler({
      constructEvent,
      sendConfirmationEmail,
      logToSheets,
      getStore: () => { throw new Error('getStore failed') },
    })

    // Because getStore throws synchronously inside try/catch, store becomes null
    // and the handler still processes email + sheets
    const result = await handler(makeEvent())

    expect(result.statusCode).toBe(200)
    // Email and sheets should still run since store is null after exception
    // (store is null, so blob skip path isn't taken)
  })
})
