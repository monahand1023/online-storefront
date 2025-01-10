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
    const { 
      quantity, 
      size, 
      studentGrade,
      program,
      pickupName,
      pickupDate,
      discountApplied 
    } = JSON.parse(event.body);
    
    const baseAmount = 2500; // $25.00 in cents
    const finalAmount = discountApplied ? Math.round(baseAmount * 0.6) : baseAmount;

    const successUrl = `${process.env.URL}/success?session_id={CHECKOUT_SESSION_ID}`;
    
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
            unit_amount: finalAmount,
          },
          quantity: quantity,
        },
      ],
      metadata: {
        size,
        quantity: quantity.toString(),
        studentGrade,
        program,
        pickupName,
        pickupDate,
        discountApplied: discountApplied ? 'true' : 'false'
      },
      success_url: successUrl,
      cancel_url: `${process.env.URL}`,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        id: session.id,
        success_url: successUrl
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