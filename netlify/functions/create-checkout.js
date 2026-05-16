import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const VALID_SIZES = ['S', 'M', 'L', 'XL'];

function sanitizeString(str, maxLength = 200) {
  if (typeof str !== 'string') return '';
  return str.replace(/[\x00-\x1f\x7f]/g, '').slice(0, maxLength);
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const {
      orders,
      studentGrade,
      program,
      pickupName,
      pickupDate,
      promoCode
    } = JSON.parse(event.body);

    // Validate orders array
    if (!Array.isArray(orders) || orders.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid orders' }),
      };
    }

    for (const order of orders) {
      if (!VALID_SIZES.includes(order.size)) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `Invalid size: ${order.size}. Must be one of ${VALID_SIZES.join(', ')}` }),
        };
      }
      const qty = parseInt(order.quantity, 10);
      if (!Number.isInteger(Number(order.quantity)) || qty < 1 || qty > 10) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Quantity must be an integer between 1 and 10' }),
        };
      }
    }

    // Server-side discount validation — never trust client-supplied discountApplied boolean
    const discountApplied =
      typeof promoCode === 'string' &&
      promoCode.trim().length > 0 &&
      process.env.DISCOUNT_CODE &&
      promoCode.trim().toUpperCase() === process.env.DISCOUNT_CODE.toUpperCase();

    const baseAmount = 2500; // $25.00 in cents
    const finalAmount = discountApplied ? Math.round(baseAmount * 0.6) : baseAmount;

    const successUrl = `${process.env.URL}/success?session_id={CHECKOUT_SESSION_ID}`;

    // Create line items for each shirt order
    const lineItems = orders.map(order => {
      const productName = sanitizeString('Japan Night T-Shirt');
      const description = sanitizeString(
        `Size: ${order.size}${discountApplied ? ' (40% Off Applied)' : ''}`
      );
      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: productName,
            description,
          },
          unit_amount: finalAmount,
        },
        quantity: parseInt(order.quantity),
      };
    });

    // Create a summary of all orders for metadata
    const ordersSummary = orders.map(order =>
      `${order.quantity}x ${order.size}`
    ).join(', ');

    const totalQuantity = orders.reduce((sum, order) =>
      sum + parseInt(order.quantity), 0
    );

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems,
      metadata: {
        ordersSummary,
        studentGrade,
        program,
        pickupName,
        pickupDate,
        totalQuantity: totalQuantity.toString(),
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
    console.error('Stripe error:', error.message, error.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'An internal error occurred. Please try again.' }),
    };
  }
};
