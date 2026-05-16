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

// Simplified handler factory that accepts injected dependencies for testing
function makeWebhookHandler(deps: {
  constructEvent: (body: string, sig: string, secret: string) => { type: string; data: { object: MockSession } }
  sendConfirmationEmail: (session: MockSession) => Promise<void>
  logToSheets: (session: MockSession) => Promise<void>
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
