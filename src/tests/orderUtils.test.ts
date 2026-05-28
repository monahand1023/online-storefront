import { describe, it, expect } from 'vitest';
import { parseOrderSummary, formatOrderSummary, formatDate, deriveOrderId } from '../../netlify/functions/shared/orderUtils.js';

// ---- parseOrderSummary ----

describe('parseOrderSummary', () => {
  it('parses "1x M, 2x L"', () => {
    const result = parseOrderSummary('1x M, 2x L');
    expect(result).toEqual([
      { qty: 1, size: 'M' },
      { qty: 2, size: 'L' },
    ]);
  });

  it('handles empty string', () => {
    expect(parseOrderSummary('')).toEqual([]);
  });

  it('handles null/undefined', () => {
    expect(parseOrderSummary(null)).toEqual([]);
    expect(parseOrderSummary(undefined)).toEqual([]);
  });

  it('handles single item', () => {
    const result = parseOrderSummary('3x XL');
    expect(result).toEqual([{ qty: 3, size: 'XL' }]);
  });

  it('filters out malformed entries', () => {
    const result = parseOrderSummary('1x M, badentry, 2x S');
    expect(result).toEqual([
      { qty: 1, size: 'M' },
      { qty: 2, size: 'S' },
    ]);
  });
});

// ---- formatOrderSummary ----

describe('formatOrderSummary', () => {
  it('formats an orders array', () => {
    const orders = [{ qty: 1, size: 'M' }, { qty: 2, size: 'L' }];
    expect(formatOrderSummary(orders)).toBe('1x M, 2x L');
  });

  it('formats a single-item array', () => {
    expect(formatOrderSummary([{ qty: 3, size: 'XL' }])).toBe('3x XL');
  });

  it('returns empty string for empty array', () => {
    expect(formatOrderSummary([])).toBe('');
  });

  it('roundtrips with parseOrderSummary', () => {
    const original = '1x S, 2x M, 3x L';
    const parsed = parseOrderSummary(original);
    const formatted = formatOrderSummary(parsed);
    expect(formatted).toBe(original);
  });
});

// ---- deriveOrderId ----

describe('deriveOrderId', () => {
  it('produces the JN- prefix', () => {
    const id = deriveOrderId('cs_test_abcdefghijklmnopqrstuvwxyz');
    expect(id).toMatch(/^JN-/);
  });

  it('produces consistent IDs from the same input', () => {
    const sessionId = 'cs_live_abc123def456ghi789';
    expect(deriveOrderId(sessionId)).toBe(deriveOrderId(sessionId));
  });

  it('strips cs_test_ prefix before slicing (last 16 chars of remainder)', () => {
    // cs_test_AABBBBBBBBBBBBBBBB -> stripped: AABBBBBBBBBBBBBBBB (18 chars) -> last 16 -> BBBBBBBBBBBBBBBB
    const id = deriveOrderId('cs_test_AABBBBBBBBBBBBBBBB');
    expect(id).toBe('JN-BBBBBBBBBBBBBBBB');
  });

  it('strips cs_ prefix before slicing (last 16 chars of remainder)', () => {
    // cs_AABBBBBBBBBBBBBBBB -> stripped: AABBBBBBBBBBBBBBBB (18 chars) -> last 16 -> BBBBBBBBBBBBBBBB
    const id = deriveOrderId('cs_AABBBBBBBBBBBBBBBB');
    expect(id).toBe('JN-BBBBBBBBBBBBBBBB');
  });

  it('handles empty string gracefully', () => {
    const id = deriveOrderId('');
    expect(id).toBe('JN-');
  });
});

// ---- formatDate ----

describe('formatDate', () => {
  it('returns a non-empty string for a given Date', () => {
    const result = formatDate(new Date('2025-06-15T10:30:00Z'));
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('does not include a comma (matches en-GB replace behavior)', () => {
    const result = formatDate(new Date('2025-06-15T10:30:00Z'));
    expect(result).not.toContain(',');
  });

  it('includes the year 2025', () => {
    const result = formatDate(new Date('2025-06-15T10:30:00Z'));
    expect(result).toContain('2025');
  });
});
