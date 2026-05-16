import { describe, it, expect } from 'vitest'

// ---- Pure validation logic mirroring create-checkout.js ----
const VALID_SIZES = ['S', 'M', 'L', 'XL']

function validateSize(size: unknown): boolean {
  return typeof size === 'string' && VALID_SIZES.includes(size)
}

function validateQuantity(quantity: unknown): boolean {
  const asNumber = Number(quantity)
  const qty = parseInt(String(quantity), 10)
  // Reject floats (1.5), NaN, and anything that doesn't parse to a whole integer
  return Number.isInteger(asNumber) && qty >= 1 && qty <= 10
}

function sanitizeString(str: unknown, maxLength = 200): string {
  if (typeof str !== 'string') return ''
  return str.replace(/[\x00-\x1f\x7f]/g, '').slice(0, maxLength)
}

// ---- Tests ----

describe('Checkout validation — size', () => {
  it('accepts all valid sizes', () => {
    for (const size of VALID_SIZES) {
      expect(validateSize(size)).toBe(true)
    }
  })

  it('rejects invalid size strings', () => {
    expect(validateSize('XXL')).toBe(false)
    expect(validateSize('small')).toBe(false)
    expect(validateSize('')).toBe(false)
    expect(validateSize('s')).toBe(false) // case-sensitive
  })

  it('rejects non-string values', () => {
    expect(validateSize(null)).toBe(false)
    expect(validateSize(undefined)).toBe(false)
    expect(validateSize(42)).toBe(false)
  })
})

describe('Checkout validation — quantity', () => {
  it('accepts quantities 1 through 10', () => {
    for (let i = 1; i <= 10; i++) {
      expect(validateQuantity(i)).toBe(true)
      expect(validateQuantity(String(i))).toBe(true) // string form also valid
    }
  })

  it('rejects quantity below 1', () => {
    expect(validateQuantity(0)).toBe(false)
    expect(validateQuantity(-1)).toBe(false)
  })

  it('rejects quantity above 10', () => {
    expect(validateQuantity(11)).toBe(false)
    expect(validateQuantity(100)).toBe(false)
  })

  it('rejects non-integer quantity', () => {
    expect(validateQuantity(1.5)).toBe(false)
    expect(validateQuantity('1.5')).toBe(false)
    expect(validateQuantity('abc')).toBe(false)
    expect(validateQuantity(null)).toBe(false)
  })
})

describe('Checkout validation — sanitizeString', () => {
  it('strips control characters from product name', () => {
    expect(sanitizeString('Hello\x00World')).toBe('HelloWorld')
    expect(sanitizeString('Test\x1fName')).toBe('TestName')
    expect(sanitizeString('Normal text')).toBe('Normal text')
  })

  it('strips DEL character (0x7f)', () => {
    expect(sanitizeString('abc\x7fdef')).toBe('abcdef')
  })

  it('truncates to maxLength', () => {
    const long = 'a'.repeat(300)
    expect(sanitizeString(long, 200).length).toBe(200)
  })

  it('returns empty string for non-string input', () => {
    expect(sanitizeString(null)).toBe('')
    expect(sanitizeString(42)).toBe('')
  })
})
