// netlify/functions/get-session.js
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const sessionId = event.queryStringParameters.session_id;

  if (!sessionId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing session_id parameter' }),
    };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        customer_email: session.customer_email,
        amount_total: session.amount_total,
        payment_status: session.payment_status,
      }),
    };
  } catch (error) {
    console.error('Error retrieving session:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to retrieve session details' }),
    };
  }
};