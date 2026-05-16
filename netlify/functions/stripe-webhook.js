import Stripe from 'stripe';
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
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
