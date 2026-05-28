/**
 * Integration test: Full checkout-to-fulfillment flow
 *
 * 1. Call the create-checkout handler with mock order data
 * 2. Capture the session metadata it would send to Stripe
 * 3. Call the stripe-webhook handler with a mock event containing that metadata
 * 4. Verify email would be sent with correct order details
 * 5. Verify sheets logging would happen with correct data
 *
 * No real HTTP calls — all Stripe SDK and side-effect functions are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BASE_PRICE_CENTS, DISCOUNT_FACTOR } from '../../netlify/functions/shared/config.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Order {
  size: string
  quantity: number | string
}

interface MockBlobStore {
  get: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
}

interface StripeSession {
  id: string
  payment_status: string
  amount_total: number
  customer_details: { email: string; name: string }
  metadata: Record<string, string>
  line_items?: unknown
}

// ---------------------------------------------------------------------------
// Create-checkout handler factory (inline, mirrors create-checkout.js logic)
// ---------------------------------------------------------------------------

function sanitizeString(str: unknown, maxLength = 200): string {
  if (typeof str !== 'string') return ''
  return str.replace(/[\x00-\x1f\x7f]/g, '').slice(0, maxLength)
}

function validatePromoCode(promoCode: unknown, serverCode: string): boolean {
  return (
    typeof promoCode === 'string' &&
    promoCode.trim().length > 0 &&
    serverCode.length > 0 &&
    promoCode.trim().toUpperCase() === serverCode.toUpperCase()
  )
}

interface MockStripeCreate {
  checkout: { sessions: { create: ReturnType<typeof vi.fn> } }
}

function makeCreateCheckoutHandler(stripe: MockStripeCreate, discountCode: string) {
  return async (event: { httpMethod: string; body: string }) => {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
    }

    const body = JSON.parse(event.body)
    const { orders, studentGrade, program, pickupName, pickupDate, promoCode } = body

    if (!Array.isArray(orders) || orders.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid orders' }) }
    }

    const VALID_SIZES = ['S', 'M', 'L', 'XL']
    for (const order of orders) {
      if (!VALID_SIZES.includes(order.size)) {
        return { statusCode: 400, body: JSON.stringify({ error: `Invalid size: ${order.size}` }) }
      }
      const qty = parseInt(String(order.quantity), 10)
      if (!Number.isInteger(Number(order.quantity)) || qty < 1 || qty > 10) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Quantity must be an integer between 1 and 10' }) }
      }
    }

    const discountApplied = validatePromoCode(promoCode, discountCode)
    const baseAmount = BASE_PRICE_CENTS
    const finalAmount = discountApplied ? Math.round(baseAmount * DISCOUNT_FACTOR) : baseAmount

    const lineItems = orders.map((order: Order) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: sanitizeString('Japan Night T-Shirt'),
          description: sanitizeString(`Size: ${order.size}${discountApplied ? ' (40% Off Applied)' : ''}`),
        },
        unit_amount: finalAmount,
      },
      quantity: parseInt(String(order.quantity)),
    }))

    const ordersSummary = orders.map((o: Order) => `${o.quantity}x ${o.size}`).join(', ')
    const totalQuantity = orders.reduce((s: number, o: Order) => s + parseInt(String(o.quantity)), 0)
    const originalAmountCents = orders.reduce(
      (sum: number, o: Order) => sum + baseAmount * parseInt(String(o.quantity)),
      0
    )

    const metadata = {
      ordersSummary,
      studentGrade,
      program,
      pickupName,
      pickupDate,
      totalQuantity: String(totalQuantity),
      discountApplied: discountApplied ? 'true' : 'false',
      original_amount_cents: String(originalAmountCents),
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems,
      metadata,
      success_url: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://example.com',
    })

    return { statusCode: 200, body: JSON.stringify({ id: session.id }) }
  }
}

// ---------------------------------------------------------------------------
// Webhook handler factory (mirrors stripe-webhook.js logic)
// ---------------------------------------------------------------------------

function makeWebhookHandler(deps: {
  constructEvent: (body: string, sig: string) => { type: string; data: { object: StripeSession } }
  sendConfirmationEmail: (session: StripeSession) => Promise<void>
  logToSheets: (session: StripeSession) => Promise<void>
  getStore?: () => MockBlobStore
}) {
  return async (event: { body: string; headers: Record<string, string> }) => {
    const sig = event.headers['stripe-signature']

    let stripeEvent: { type: string; data: { object: StripeSession } }
    try {
      stripeEvent = deps.constructEvent(event.body, sig)
    } catch {
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
              return { statusCode: 200, body: JSON.stringify({ received: true }) }
            }
          } catch {
            store = null
          }
        }

        try { await deps.sendConfirmationEmail(session) } catch { /* swallow */ }
        try { await deps.logToSheets(session) } catch { /* swallow */ }

        if (store !== null) {
          try { await store.set(session.id, String(Date.now()), { ttl: 7 * 24 * 60 * 60 }) } catch { /* swallow */ }
        }
      }
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) }
  }
}

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

describe('Checkout to fulfillment flow', () => {
  let mockStripeCreate: ReturnType<typeof vi.fn>
  let sendConfirmationEmail: ReturnType<typeof vi.fn>
  let logToSheets: ReturnType<typeof vi.fn>
  let blobStore: MockBlobStore
  let capturedMetadata: Record<string, string>

  beforeEach(() => {
    capturedMetadata = {}
    mockStripeCreate = vi.fn().mockImplementation((params: { metadata: Record<string, string> }) => {
      capturedMetadata = params.metadata
      return Promise.resolve({ id: 'cs_test_integration_001' })
    })
    sendConfirmationEmail = vi.fn().mockResolvedValue(undefined)
    logToSheets = vi.fn().mockResolvedValue(undefined)
    blobStore = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    }
  })

  it('creates session with correct metadata then webhook processes it', async () => {
    // 1. Call create-checkout handler with mock order data
    const checkoutHandler = makeCreateCheckoutHandler(
      { checkout: { sessions: { create: mockStripeCreate } } },
      'JAPAN40'
    )

    const checkoutResult = await checkoutHandler({
      httpMethod: 'POST',
      body: JSON.stringify({
        orders: [{ size: 'M', quantity: 2 }, { size: 'L', quantity: 1 }],
        studentGrade: '3',
        program: 'Japanese',
        pickupName: 'Jane Doe',
        pickupDate: '2/15',
        promoCode: '',
      }),
    })

    // 2. Verify checkout created successfully and metadata was captured
    expect(checkoutResult.statusCode).toBe(200)
    expect(JSON.parse(checkoutResult.body).id).toBe('cs_test_integration_001')
    expect(capturedMetadata.ordersSummary).toBe('2x M, 1x L')
    expect(capturedMetadata.totalQuantity).toBe('3')
    expect(capturedMetadata.discountApplied).toBe('false')
    expect(capturedMetadata.original_amount_cents).toBe(String(BASE_PRICE_CENTS * 3))
    expect(capturedMetadata.studentGrade).toBe('3')
    expect(capturedMetadata.pickupName).toBe('Jane Doe')

    // 3. Build a mock Stripe session from the captured metadata (simulates webhook payload)
    const mockStripeSession: StripeSession = {
      id: 'cs_test_integration_001',
      payment_status: 'paid',
      amount_total: BASE_PRICE_CENTS * 3,
      customer_details: { email: 'buyer@example.com', name: 'Jane Doe' },
      metadata: capturedMetadata,
    }

    // 4. Call stripe-webhook handler with that session
    const webhookHandler = makeWebhookHandler({
      constructEvent: () => ({
        type: 'checkout.session.completed',
        data: { object: mockStripeSession },
      }),
      sendConfirmationEmail,
      logToSheets,
      getStore: () => blobStore,
    })

    const webhookResult = await webhookHandler({
      body: JSON.stringify(mockStripeSession),
      headers: { 'stripe-signature': 'valid_sig' },
    })

    // 5. Verify email was sent with correct order details
    expect(webhookResult.statusCode).toBe(200)
    expect(sendConfirmationEmail).toHaveBeenCalledOnce()
    const emailSession = sendConfirmationEmail.mock.calls[0][0] as StripeSession
    expect(emailSession.customer_details.email).toBe('buyer@example.com')
    expect(emailSession.metadata.ordersSummary).toBe('2x M, 1x L')
    expect(emailSession.metadata.pickupName).toBe('Jane Doe')
    expect(emailSession.metadata.pickupDate).toBe('2/15')

    // 6. Verify sheets logging happened with correct data
    expect(logToSheets).toHaveBeenCalledOnce()
    const sheetsSession = logToSheets.mock.calls[0][0] as StripeSession
    expect(sheetsSession.amount_total).toBe(BASE_PRICE_CENTS * 3)
    expect(sheetsSession.metadata.ordersSummary).toBe('2x M, 1x L')
    expect(sheetsSession.metadata.studentGrade).toBe('3')
    expect(sheetsSession.metadata.program).toBe('Japanese')
    expect(sheetsSession.metadata.discountApplied).toBe('false')
  })

  it('discount flow: discounted price flows through to email and sheets', async () => {
    const checkoutHandler = makeCreateCheckoutHandler(
      { checkout: { sessions: { create: mockStripeCreate } } },
      'JAPAN40'
    )

    await checkoutHandler({
      httpMethod: 'POST',
      body: JSON.stringify({
        orders: [{ size: 'S', quantity: 1 }],
        studentGrade: 'K',
        program: 'Spanish',
        pickupName: 'Bob',
        pickupDate: '2/16',
        promoCode: 'JAPAN40',
      }),
    })

    const discountedTotal = Math.round(BASE_PRICE_CENTS * DISCOUNT_FACTOR)

    expect(capturedMetadata.discountApplied).toBe('true')
    expect(capturedMetadata.original_amount_cents).toBe(String(BASE_PRICE_CENTS))

    const mockStripeSession: StripeSession = {
      id: 'cs_test_integration_002',
      payment_status: 'paid',
      amount_total: discountedTotal,
      customer_details: { email: 'bob@example.com', name: 'Bob' },
      metadata: capturedMetadata,
    }

    const webhookHandler = makeWebhookHandler({
      constructEvent: () => ({
        type: 'checkout.session.completed',
        data: { object: mockStripeSession },
      }),
      sendConfirmationEmail,
      logToSheets,
      getStore: () => blobStore,
    })

    await webhookHandler({
      body: JSON.stringify(mockStripeSession),
      headers: { 'stripe-signature': 'valid_sig' },
    })

    // Email and sheets should see discountApplied = 'true'
    const emailSession = sendConfirmationEmail.mock.calls[0][0] as StripeSession
    expect(emailSession.metadata.discountApplied).toBe('true')
    expect(emailSession.metadata.original_amount_cents).toBe(String(BASE_PRICE_CENTS))
    expect(emailSession.amount_total).toBe(discountedTotal)

    const sheetsSession = logToSheets.mock.calls[0][0] as StripeSession
    expect(sheetsSession.metadata.discountApplied).toBe('true')
  })

  it('full flow: duplicate webhook for same session is idempotent', async () => {
    const session: StripeSession = {
      id: 'cs_test_integration_003',
      payment_status: 'paid',
      amount_total: BASE_PRICE_CENTS,
      customer_details: { email: 'test@example.com', name: 'Test User' },
      metadata: {
        ordersSummary: '1x M',
        studentGrade: '4',
        program: 'Japanese',
        pickupName: 'Test User',
        pickupDate: '2/17',
        discountApplied: 'false',
        original_amount_cents: String(BASE_PRICE_CENTS),
        totalQuantity: '1',
      },
    }

    const webhookHandler = makeWebhookHandler({
      constructEvent: () => ({
        type: 'checkout.session.completed',
        data: { object: session },
      }),
      sendConfirmationEmail,
      logToSheets,
      getStore: () => blobStore,
    })

    // First delivery
    blobStore.get.mockResolvedValueOnce(null)
    await webhookHandler({
      body: JSON.stringify(session),
      headers: { 'stripe-signature': 'sig' },
    })

    // Second delivery (blob store now returns a value)
    blobStore.get.mockResolvedValueOnce(String(Date.now()))
    await webhookHandler({
      body: JSON.stringify(session),
      headers: { 'stripe-signature': 'sig' },
    })

    // Email and sheets should only be called once across both deliveries
    expect(sendConfirmationEmail).toHaveBeenCalledOnce()
    expect(logToSheets).toHaveBeenCalledOnce()
  })
})
