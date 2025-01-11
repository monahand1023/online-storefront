// netlify/functions/send-email.js
import nodemailer from 'nodemailer';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { email, orderDetails } = JSON.parse(event.body);

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    const mailOptions = {
      from: 'committee@example.com',
      to: email,
      subject: 'Event T-Shirt Order Confirmation',
      html: `
        <h1>Thank You for Your Order!</h1>
        <h2>Order Details:</h2>
        <p>Order Summary: ${orderDetails.ordersSummary}</p>
        <p>Total Amount: $${(orderDetails.amount_total / 100).toFixed(2)}</p>
        <p>Pickup Name: ${orderDetails.pickupName}</p>
        <p>Pickup Date: ${orderDetails.pickupDate}</p>
        <p>Student Grade: ${orderDetails.studentGrade}</p>
        <p>Program: ${orderDetails.program}</p>
        
        <h2>What's Next?</h2>
        <ul>
          <li>Your t-shirt(s) will be available for pickup on ${orderDetails.pickupDate}</li>
          <li>Please bring ID for verification during pickup</li>
          <li>The pickup person must match the name provided: ${orderDetails.pickupName}</li>
        </ul>
        
        <p>If you have any questions, please contact us at committee@example.com</p>
      `
    };

    await transporter.sendMail(mailOptions);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Email sent successfully' }),
    };
  } catch (error) {
    console.error('Email error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send email' }),
    };
  }
};