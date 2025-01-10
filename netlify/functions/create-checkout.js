import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { quantity, size } = JSON.parse(event.body);
    
    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
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
      customer_email: undefined, // Let Stripe collect email during checkout
      success_url: `${process.env.URL}/success`,
      cancel_url: `${process.env.URL}`,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ id: session.id }),
    };
  } catch (error) {
    console.error('Stripe error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};