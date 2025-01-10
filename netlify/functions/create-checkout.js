// netlify/functions/create-checkout.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { quantity, size } = JSON.parse(event.body);
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email_collection: true, // This will collect the email during checkout
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Event T-Shirt',
              description: `Size: ${size}`,
            },
            unit_amount: 2500, // $25.00 in cents
          },
          quantity: quantity,
        },
      ],
      mode: 'payment',
      success_url: 'http://localhost:8888/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'http://localhost:8888',
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ id: session.id }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};