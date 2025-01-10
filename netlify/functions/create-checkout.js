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
    
    // Log the URL being used
    console.log('Site URL:', process.env.URL);
    const successUrl = `${process.env.URL}/success?session_id={CHECKOUT_SESSION_ID}`;
    console.log('Success URL:', successUrl);
    
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
      metadata: {
        size,
        quantity: quantity.toString()
      },
      success_url: successUrl,
      cancel_url: `${process.env.URL}`,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        id: session.id,
        success_url: successUrl // Include in response for debugging
      }),
    };
  } catch (error) {
    console.error('Stripe error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};