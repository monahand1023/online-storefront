// netlify/functions/log-to-sheets.js

exports.handler = async function(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Log incoming request for debugging
    console.log('Received request body:', event.body);

    const { timestamp, amount, quantity, size, status } = JSON.parse(event.body);

    // Log parsed data
    console.log('Parsed data:', { timestamp, amount, quantity, size, status });

    // Validate required fields
    if (!timestamp || !amount || !quantity || !size || !status) {
      console.log('Missing required fields:', { timestamp, amount, quantity, size, status });
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Missing required fields',
          received: { timestamp, amount, quantity, size, status }
        })
      };
    }

    // Log environment variables (without exposing full values)
    console.log('Environment check:', {
      hasSpreadsheetId: !!process.env.GOOGLE_SPREADSHEET_ID,
      hasApiKey: !!process.env.GOOGLE_API_KEY
    });

    const SHEETS_API_ENDPOINT = 'https://sheets.googleapis.com/v4/spreadsheets';
    const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
    const API_KEY = process.env.GOOGLE_API_KEY;

    if (!SPREADSHEET_ID || !API_KEY) {
      throw new Error('Missing required environment variables');
    }

    const values = [[timestamp, amount, quantity, size, status]];

    // Log the request we're about to make (without exposing the API key)
    console.log('Making request to Google Sheets API:', {
      spreadsheetId: SPREADSHEET_ID,
      values: values
    });

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

    // Log response status
    console.log('Google Sheets API response status:', response.status);

    const responseData = await response.json();
    
    // Log response data
    console.log('Google Sheets API response:', responseData);

    if (!response.ok) {
      throw new Error(responseData.error?.message || 'Failed to log to Google Sheets');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Successfully logged to Google Sheets',
        details: responseData
      })
    };
  } catch (error) {
    console.error('Error in log-to-sheets function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to log transaction',
        details: error.message
      })
    };
  }
};