export const BASE_PRICE_CENTS = 2500;
export const DISCOUNT_FACTOR = 0.6;
// Product name used for the Stripe line item and the confirmation-email subject.
// Keep in sync with PRODUCT_NAME in src/config/store.ts (the frontend copy).
export const PRODUCT_NAME = 'Event T-Shirt';
// Sender + CC for confirmation emails. Set ADMIN_EMAIL in the Netlify dashboard;
// the fallback is a placeholder so a misconfigured deploy never emails a real inbox.
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'orders@example.com';
