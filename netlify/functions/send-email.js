import nodemailer from 'nodemailer';
import { parseOrderSummary } from './shared/orderUtils.js';
import { ADMIN_EMAIL } from './shared/config.js';

/**
 * Send a confirmation email for a completed Stripe checkout session.
 * Can be called directly from the webhook handler.
 * @param {object} session - Stripe checkout session object
 */
export async function sendConfirmationEmail(session) {
  const email = session.customer_details?.email;
  if (!email) {
    throw new Error('No email address in session customer_details');
  }

  const metadata = session.metadata || {};
  const orderItems = metadata.ordersSummary
    ? parseOrderSummary(metadata.ordersSummary).map(item => `${item.qty} × Size ${item.size}`)
    : [];

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const amountDisplay = `$${(session.amount_total / 100).toFixed(2)}`;
  const pickupDate = metadata.pickupDate || 'your selected date';
  const pickupName = metadata.pickupName || 'the name provided';

  const mailOptions = {
    from: ADMIN_EMAIL,
    to: email,
    cc: ADMIN_EMAIL,
    subject: 'Japan Night T-Shirt Order Confirmation',
    html: `
      <h1>Thank You for Your Order!</h1>
      <h2>Order Details:</h2>
      <h3>Order Items:</h3>
      <ul>
        ${orderItems.map(item => `<li>${item}</li>`).join('')}
      </ul>
      <p>Total Amount: ${amountDisplay}</p>
      <p>Pickup Name: ${metadata.pickupName || 'Not provided'}</p>
      <p>Pickup Date: ${metadata.pickupDate || 'Not provided'}</p>
      <p>Student Grade: ${metadata.studentGrade || 'Not provided'}</p>
      <p>Program: ${metadata.program || 'Not provided'}</p>

      <h2>What's Next?</h2>
      <ul>
        <li>Your t-shirt(s) will be available for pickup on ${pickupDate}</li>
        <li>Please bring ID for verification during pickup</li>
        <li>The pickup person must match the name provided: ${pickupName}</li>
      </ul>

      <p>If you have any questions, please contact us at ${ADMIN_EMAIL}</p>
    `
  };

  const result = await transporter.sendMail(mailOptions);
  console.log('Email sent successfully:', { messageId: result.messageId });
}

// HTTP handler — kept for any direct invocations but email/logging is now
// primarily handled by the Stripe webhook.
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No request body provided' }),
      };
    }

    const { email, orderDetails } = JSON.parse(event.body);

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No email address provided' }),
      };
    }

    if (!orderDetails) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No order details provided' }),
      };
    }

    // Build a minimal session-like object so we can reuse sendConfirmationEmail
    const syntheticSession = {
      customer_details: { email },
      amount_total: orderDetails.amount_total,
      metadata: {
        ordersSummary: orderDetails.orderItems
          ? orderDetails.orderItems
              .map(item => item.replace(' × Size ', 'x '))
              .join(', ')
          : '',
        pickupDate: orderDetails.pickupDate,
        pickupName: orderDetails.pickupName,
        studentGrade: orderDetails.studentGrade,
        program: orderDetails.program,
      },
    };

    await sendConfirmationEmail(syntheticSession);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Email sent successfully' }),
    };
  } catch (error) {
    console.error('Email error:', error.message, error.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'An internal error occurred. Please try again.' }),
    };
  }
};
