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
    console.log('Starting email send process...');
    
    if (!event.body) {
      console.error('No request body provided');
      throw new Error('No request body provided');
    }
    
    const { email, orderDetails } = JSON.parse(event.body);
    
    if (!email) {
      console.error('No email address provided');
      throw new Error('No email address provided');
    }
    
    if (!orderDetails) {
      console.error('No order details provided');
      throw new Error('No order details provided');
    }
    
    console.log('Request data received:', { 
      email, 
      hasOrderItems: !!orderDetails.orderItems,
      pickupDate: orderDetails.pickupDate,
      totalAmount: orderDetails.amount_total
    });

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    console.log('SMTP Configuration:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      hasPassword: !!process.env.SMTP_PASSWORD
    });

    const mailOptions = {
      from: 'orders@example.com',
      to: email,
      cc: 'orders@example.com',
      subject: 'Event T-Shirt Order Confirmation',
      html: `
        <h1>Thank You for Your Order!</h1>
        <h2>Order Details:</h2>
        <h3>Order Items:</h3>
        <ul>
          ${orderDetails.orderItems.map(item => `<li>${item}</li>`).join('')}
        </ul>
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
        
        <p>If you have any questions, please contact us at orders@example.com</p>
      `
    };

    console.log('Attempting to send email...');
    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', {
      messageId: result.messageId,
      response: result.response
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Email sent successfully' }),
    };
  } catch (error) {
    console.error('Email error:', {
      message: error.message,
      code: error.code,
      command: error.command,
      stack: error.stack
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send email', details: error.message }),
    };
  }
};