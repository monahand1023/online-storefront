// netlify/functions/log-to-sheets.js
import fetch from 'node-fetch';

exports.handler = async function(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { timestamp, amount, quantity, size, status } = JSON.parse(event.body);

    // Validate required fields
    if (!timestamp || !amount || !quantity || !size || !status) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    const SHEETS_API_ENDPOINT = 'https://sheets.googleapis.com/v4/spreadsheets';
    const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
    const API_KEY = process.env.GOOGLE_API_KEY;

    const values = [[timestamp, amount, quantity, size, status]];

    const response = await fetch(
      `${SHEETS_API_ENDPOINT}/${SPREADSHEET_ID}/values/A:E:append?valueInputOption=RAW&key=${API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: values,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to log to Google Sheets');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully logged to Google Sheets' })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to log transaction' })
    };
  }
};