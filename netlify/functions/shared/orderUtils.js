/**
 * Parse an order summary string like "1x M, 2x L" into structured data.
 * @param {string} summary
 * @returns {{ qty: number, size: string }[]}
 */
export function parseOrderSummary(summary) {
  if (!summary) return [];
  return summary.split(', ').map(part => {
    const [qtyStr, size] = part.trim().split('x ');
    return { qty: parseInt(qtyStr, 10), size: (size || '').trim() };
  }).filter(item => !isNaN(item.qty) && item.size);
}

/**
 * Format an orders array into "1x M, 2x L" string.
 * @param {{ qty: number, size: string }[]} orders
 * @returns {string}
 */
export function formatOrderSummary(orders) {
  return orders.map(o => `${o.qty}x ${o.size}`).join(', ');
}

/**
 * Format a Date as a locale-friendly string.
 * Matches the format used in log-to-sheets.js (en-GB, 24h, no comma).
 * @param {Date} date
 * @returns {string}
 */
export function formatDate(date) {
  return date.toLocaleString('en-GB', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).replace(',', '');
}

/**
 * Derive a stable order ID from the Stripe session ID.
 * Uses the last 16 characters of the session ID (after stripping the cs_/cs_test_ prefix).
 * @param {string} sessionId
 * @returns {string}
 */
export function deriveOrderId(sessionId) {
  const stripped = (sessionId || '').replace('cs_test_', '').replace('cs_', '');
  return `JN-${stripped.slice(-16).toUpperCase()}`;
}
