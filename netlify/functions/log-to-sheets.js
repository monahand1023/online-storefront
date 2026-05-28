import { google } from 'googleapis';
import { formatDate, deriveOrderId, parseOrderSummary } from './shared/orderUtils.js';

/**
 * Log a completed Stripe checkout session to Google Sheets.
 * Can be called directly from the webhook handler.
 * @param {object} session - Stripe checkout session object
 */
export async function logToSheets(session) {
  const metadata = session.metadata || {};
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  const timestamp = formatDate(new Date());

  // Derive a stable order ID from the Stripe session ID
  const sessionId = session.id || '';
  const orderId = deriveOrderId(sessionId);

  const ordersSummary = metadata.ordersSummary || '';
  const totalAmount = (session.amount_total || 0) / 100;
  const email = session.customer_details?.email || 'Not provided';
  const customerName = session.customer_details?.name || 'Not provided';

  if (!ordersSummary) {
    // Fall back to a single row if no order breakdown is available
    const values = [[
      timestamp,
      orderId,
      totalAmount,
      metadata.totalQuantity || '',
      '',
      session.payment_status || '',
      email,
      customerName,
      metadata.studentGrade || 'N/A',
      metadata.program || 'N/A',
      metadata.pickupName || 'N/A',
      metadata.pickupDate || 'N/A',
      metadata.discountApplied === 'true' ? 'Yes' : 'No',
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
      range: 'A:M',
      valueInputOption: 'RAW',
      requestBody: { values },
    });
    return;
  }

  // One row per size/quantity line item
  const orderLines = parseOrderSummary(ordersSummary);
  const totalQuantity = orderLines.reduce((sum, item) => sum + item.qty, 0);
  const pricePerShirt = totalQuantity > 0 ? totalAmount / totalQuantity : totalAmount;

  const rows = orderLines.map(item => {
    const { qty, size } = item;
    const lineAmount = pricePerShirt * qty;
    return [
      timestamp,
      orderId,
      lineAmount,
      qty,
      size,
      session.payment_status || '',
      email,
      customerName,
      metadata.studentGrade || 'N/A',
      metadata.program || 'N/A',
      metadata.pickupName || 'N/A',
      metadata.pickupDate || 'N/A',
      metadata.discountApplied === 'true' ? 'Yes' : 'No',
    ];
  });

  for (const row of rows) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
      range: 'A:M',
      valueInputOption: 'RAW',
      requestBody: { values: [row] },
    });
  }
}

// HTTP handler — kept for backwards compatibility but email/logging is now
// primarily handled by the Stripe webhook.
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const {
      timestamp,
      orderId,
      amount,
      quantity,
      size,
      status,
      email,
      customerName,
      studentGrade,
      program,
      pickupName,
      pickupDate,
      discountApplied,
    } = JSON.parse(event.body);

    if (!timestamp || !amount || !quantity || !size || !status) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const values = [[
      timestamp,
      orderId,
      amount,
      quantity,
      size,
      status,
      email,
      customerName || 'N/A',
      studentGrade || 'N/A',
      program || 'N/A',
      pickupName || 'N/A',
      pickupDate || 'N/A',
      discountApplied ? 'Yes' : 'No',
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
      range: 'A:M',
      valueInputOption: 'RAW',
      requestBody: { values },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully logged to Google Sheets' }),
    };
  } catch (error) {
    console.error('Error in log-to-sheets function:', error.message, error.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'An internal error occurred. Please try again.' }),
    };
  }
};
