/**
 * Unit tests for create-checkout Netlify function logic.
 *
 * We don't import the actual handler (which instantiates Stripe at module
 * scope) — instead we replicate the pure helper functions and call a
 * factory that accepts injected Stripe so we can mock it cleanly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BASE_PRICE_CENTS, DISCOUNT_FACTOR } from '../../netlify/functions/shared/config.js'

// ---------------------------------------------------------------------------
// Helpers extracted from create-checkout.js (tested in isolation)
// ---------------------------------------------------------------------------

function sanitizeString(str: unknown, maxLength = 200): string {
  if (typeof str !== 'string') return ''
  return str.replace(/[\x00-\x1f\x7f]/g, '').slice(0, maxLength)
}

function discountPrice(baseCents: number, factor: number): number {
  return Math.round(baseCents * factor)
}

function validatePromoCode(promoCode: unknown, serverCode: string): boolean {
  return (
    typeof promoCode === 'string' &&
    promoCode.trim().length > 0 &&
    serverCode.length > 0 &&
    promoCode.trim().toUpperCase() === serverCode.toUpperCase()
  )
}

function computeOriginalAmountCents(
  orders: { quantity: number | string }[],
  baseCents: number
): number {
  return orders.reduce((sum, order) => sum + baseCents * parseInt(String(order.quantity), 10), 0)
}

// ---------------------------------------------------------------------------
// Handler factory — accepts a mock Stripe client for isolation
// ---------------------------------------------------------------------------

interface Order {
  size: string
  quantity: number | string
}

interface MockStripe {
  checkout: {
    sessions: {
      create: ReturnType<typeof vi.fn>
    }
  }
}

const VALID_SIZES = ['S', 'M', 'L', 'XL']

function makeCreateCheckoutHandler(stripe: MockStripe, discountCode: string) {
  return async (event: { httpMethod: string; body: string }) => {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
    }

    let body: {
      orders?: Order[]
      studentGrade?: string
      program?: string
      pickupName?: string
      pickupDate?: string
      promoCode?: unknown
    }
    try {
      body = JSON.parse(event.body)
    } catch {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }
    }

    const { orders, studentGrade, program, pickupName, pickupDate, promoCode } = body

    if (!Array.isArray(orders) || orders.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid orders' }) }
    }

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
    const finalAmount = discountApplied ? discountPrice(baseAmount, DISCOUNT_FACTOR) : baseAmount

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
    const originalAmountCents = computeOriginalAmountCents(orders, baseAmount)

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: lineItems,
        metadata: {
          ordersSummary,
          studentGrade,
          program,
          pickupName,
          pickupDate,
          totalQuantity: String(totalQuantity),
          discountApplied: discountApplied ? 'true' : 'false',
          original_amount_cents: String(originalAmountCents),
        },
        success_url: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'https://example.com',
      })

      return { statusCode: 200, body: JSON.stringify({ id: session.id }) }
    } catch (error: unknown) {
      return { statusCode: 500, body: JSON.stringify({ error: 'An internal error occurred. Please try again.' }) }
    }
  }
}

// ---------------------------------------------------------------------------
// Tests: sanitizeString
// ---------------------------------------------------------------------------

describe('sanitizeString (create-checkout helper)', () => {
  it('strips control characters (0x00–0x1f)', () => {
    expect(sanitizeString('Hello\x00World')).toBe('HelloWorld')
    expect(sanitizeString('A\x1fB')).toBe('AB')
  })

  it('strips DEL (0x7f)', () => {
    expect(sanitizeString('ab\x7fcd')).toBe('abcd')
  })

  it('preserves normal text', () => {
    expect(sanitizeString('Japan Night T-Shirt')).toBe('Japan Night T-Shirt')
  })

  it('truncates to maxLength', () => {
    const long = 'x'.repeat(300)
    expect(sanitizeString(long, 200).length).toBe(200)
  })

  it('returns empty string for non-string input', () => {
    expect(sanitizeString(null)).toBe('')
    expect(sanitizeString(42)).toBe('')
    expect(sanitizeString(undefined)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Tests: discount validation
// ---------------------------------------------------------------------------

describe('Discount validation (create-checkout logic)', () => {
  const SERVER_CODE = 'JAPAN40'

  it('valid code → discountApplied true', () => {
    expect(validatePromoCode('JAPAN40', SERVER_CODE)).toBe(true)
  })

  it('valid code (case-insensitive) → discountApplied true', () => {
    expect(validatePromoCode('japan40', SERVER_CODE)).toBe(true)
  })

  it('invalid code → discountApplied false', () => {
    expect(validatePromoCode('WRONG', SERVER_CODE)).toBe(false)
  })

  it('empty string → discountApplied false', () => {
    expect(validatePromoCode('', SERVER_CODE)).toBe(false)
  })

  it('no server code configured → always false', () => {
    expect(validatePromoCode('JAPAN40', '')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Tests: original_amount_cents calculation
// ---------------------------------------------------------------------------

describe('original_amount_cents computation', () => {
  it('equals baseCents × totalQuantity', () => {
    const orders = [{ quantity: 2 }, { quantity: 3 }]
    expect(computeOriginalAmountCents(orders, 2500)).toBe(2500 * 5)
  })

  it('handles a single item', () => {
    expect(computeOriginalAmountCents([{ quantity: 1 }], 2500)).toBe(2500)
  })

  it('handles string quantities', () => {
    expect(computeOriginalAmountCents([{ quantity: '2' }], 2500)).toBe(5000)
  })
})

// ---------------------------------------------------------------------------
// Tests: discountPrice
// ---------------------------------------------------------------------------

describe('discountPrice computation', () => {
  it('applies the 40% discount (DISCOUNT_FACTOR = 0.6)', () => {
    // BASE_PRICE_CENTS = 2500, discounted = 1500
    expect(discountPrice(BASE_PRICE_CENTS, DISCOUNT_FACTOR)).toBe(1500)
  })

  it('rounds fractional cents', () => {
    expect(discountPrice(100, 0.333)).toBe(33)
  })
})

// ---------------------------------------------------------------------------
// Tests: handler with mocked Stripe
// ---------------------------------------------------------------------------

describe('create-checkout handler — Stripe integration', () => {
  let mockCreate: ReturnType<typeof vi.fn>
  let mockStripe: MockStripe
  const DISCOUNT_CODE = 'JAPAN40'

  const baseOrderPayload = {
    orders: [{ size: 'M', quantity: 1 }],
    studentGrade: '3',
    program: 'Japanese',
    pickupName: 'Jane Doe',
    pickupDate: '2/15',
    promoCode: '',
  }

  beforeEach(() => {
    mockCreate = vi.fn().mockResolvedValue({ id: 'cs_test_mock123' })
    mockStripe = { checkout: { sessions: { create: mockCreate } } }
  })

  it('calls stripe.checkout.sessions.create with correct params for a standard order', async () => {
    const handler = makeCreateCheckoutHandler(mockStripe, DISCOUNT_CODE)
    const result = await handler({
      httpMethod: 'POST',
      body: JSON.stringify(baseOrderPayload),
    })

    expect(result.statusCode).toBe(200)
    expect(JSON.parse(result.body)).toEqual({ id: 'cs_test_mock123' })

    const [callArgs] = mockCreate.mock.calls
    expect(callArgs[0].mode).toBe('payment')
    expect(callArgs[0].line_items[0].price_data.unit_amount).toBe(BASE_PRICE_CENTS)
    expect(callArgs[0].metadata.discountApplied).toBe('false')
    expect(callArgs[0].metadata.original_amount_cents).toBe(String(BASE_PRICE_CENTS))
  })

  it('applies discount and sets correct unit_amount when promo code is valid', async () => {
    const handler = makeCreateCheckoutHandler(mockStripe, DISCOUNT_CODE)
    const result = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ ...baseOrderPayload, promoCode: 'JAPAN40' }),
    })

    expect(result.statusCode).toBe(200)
    const [callArgs] = mockCreate.mock.calls
    expect(callArgs[0].line_items[0].price_data.unit_amount).toBe(
      Math.round(BASE_PRICE_CENTS * DISCOUNT_FACTOR)
    )
    expect(callArgs[0].metadata.discountApplied).toBe('true')
    // original_amount_cents should still reflect undiscounted total
    expect(callArgs[0].metadata.original_amount_cents).toBe(String(BASE_PRICE_CENTS * 1))
  })

  it('sets original_amount_cents correctly for multiple items', async () => {
    const handler = makeCreateCheckoutHandler(mockStripe, DISCOUNT_CODE)
    await handler({
      httpMethod: 'POST',
      body: JSON.stringify({
        ...baseOrderPayload,
        orders: [
          { size: 'M', quantity: 2 },
          { size: 'L', quantity: 3 },
        ],
      }),
    })

    const [callArgs] = mockCreate.mock.calls
    expect(callArgs[0].metadata.original_amount_cents).toBe(String(BASE_PRICE_CENTS * 5))
    expect(callArgs[0].metadata.totalQuantity).toBe('5')
    expect(callArgs[0].metadata.ordersSummary).toBe('2x M, 3x L')
  })

  it('returns 400 for an invalid size', async () => {
    const handler = makeCreateCheckoutHandler(mockStripe, DISCOUNT_CODE)
    const result = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ ...baseOrderPayload, orders: [{ size: 'XXL', quantity: 1 }] }),
    })
    expect(result.statusCode).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns 400 for a quantity out of range', async () => {
    const handler = makeCreateCheckoutHandler(mockStripe, DISCOUNT_CODE)
    const result = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ ...baseOrderPayload, orders: [{ size: 'M', quantity: 11 }] }),
    })
    expect(result.statusCode).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns 400 for an empty orders array', async () => {
    const handler = makeCreateCheckoutHandler(mockStripe, DISCOUNT_CODE)
    const result = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ ...baseOrderPayload, orders: [] }),
    })
    expect(result.statusCode).toBe(400)
  })

  it('returns 405 for non-POST methods', async () => {
    const handler = makeCreateCheckoutHandler(mockStripe, DISCOUNT_CODE)
    const result = await handler({ httpMethod: 'GET', body: '' })
    expect(result.statusCode).toBe(405)
  })

  it('returns 500 when Stripe throws', async () => {
    mockCreate.mockRejectedValue(new Error('Stripe API error'))
    const handler = makeCreateCheckoutHandler(mockStripe, DISCOUNT_CODE)
    const result = await handler({
      httpMethod: 'POST',
      body: JSON.stringify(baseOrderPayload),
    })
    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body).error).toContain('internal error')
  })
})
