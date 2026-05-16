import { describe, it, expect } from 'vitest'

// ---- Pure discount validation logic mirroring create-checkout.js ----
function validatePromoCode(promoCode: unknown, serverCode: string): boolean {
  return (
    typeof promoCode === 'string' &&
    promoCode.trim().length > 0 &&
    serverCode.length > 0 &&
    promoCode.trim().toUpperCase() === serverCode.toUpperCase()
  )
}

// ---- Tests ----

describe('Discount validation', () => {
  const DISCOUNT_CODE = 'JAPAN40'

  it('accepts a valid promo code (exact match)', () => {
    expect(validatePromoCode('JAPAN40', DISCOUNT_CODE)).toBe(true)
  })

  it('accepts a valid promo code (case-insensitive)', () => {
    expect(validatePromoCode('japan40', DISCOUNT_CODE)).toBe(true)
    expect(validatePromoCode('Japan40', DISCOUNT_CODE)).toBe(true)
    expect(validatePromoCode('JAPAN40', 'japan40')).toBe(true)
  })

  it('accepts a valid promo code with surrounding whitespace', () => {
    expect(validatePromoCode('  JAPAN40  ', DISCOUNT_CODE)).toBe(true)
  })

  it('rejects an invalid promo code', () => {
    expect(validatePromoCode('WRONG', DISCOUNT_CODE)).toBe(false)
    expect(validatePromoCode('JAPAN41', DISCOUNT_CODE)).toBe(false)
  })

  it('rejects an empty promo code', () => {
    expect(validatePromoCode('', DISCOUNT_CODE)).toBe(false)
    expect(validatePromoCode('   ', DISCOUNT_CODE)).toBe(false)
  })

  it('rejects non-string promo code', () => {
    expect(validatePromoCode(null, DISCOUNT_CODE)).toBe(false)
    expect(validatePromoCode(undefined, DISCOUNT_CODE)).toBe(false)
    expect(validatePromoCode(true, DISCOUNT_CODE)).toBe(false)
  })

  it('never applies discount when server code is not configured', () => {
    expect(validatePromoCode('JAPAN40', '')).toBe(false)
  })
})
