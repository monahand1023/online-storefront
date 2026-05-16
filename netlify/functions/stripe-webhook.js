import Stripe from 'stripe';
import { getStore } from '@netlify/blobs';
import { sendConfirmationEmail } from './send-email.js';
import { logToSheets } from './log-to-sheets.js';

export const handler = async (event) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = event.headers['stripe-signature'];

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: 'Webhook Error' };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;

    if (session.payment_status === 'paid') {
      // Idempotency check — skip if we've already processed this session
      let alreadyProcessed = false;
      let store;
      try {
        store = getStore('processed-webhooks');
        const existing = await store.get(session.id);
        if (existing !== null) {
          console.log(`Duplicate webhook for session ${session.id}, skipping`);
          return { statusCode: 200, body: JSON.stringify({ received: true }) };
        }
      } catch (err) {
        // Blob store unavailable — log and proceed rather than blocking order processing
        console.warn('Blob store unavailable for idempotency check, proceeding anyway:', err.message);
        store = null;
      }

      // Send confirmation email
      try {
        await sendConfirmationEmail(session);
      } catch (err) {
        // Don't fail the webhook — Stripe will retry if we return non-200
        console.error('Failed to send confirmation email:', err.message);
      }

      // Log to Google Sheets
      try {
        await logToSheets(session);
      } catch (err) {
        console.error('Failed to log to sheets:', err.message);
      }

      // Mark session as processed (7-day TTL)
      if (store !== null) {
        try {
          await store.set(session.id, Date.now().toString(), { ttl: 7 * 24 * 60 * 60 });
        } catch (err) {
          console.warn('Failed to mark session as processed in blob store:', err.message);
        }
      }
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
