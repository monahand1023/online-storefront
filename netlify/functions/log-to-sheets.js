// netlify/functions/log-to-sheets.js
import { google } from 'googleapis';

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { timestamp, amount, quantity, size, status } = JSON.parse(event.body);
    console.log('Received data:', { timestamp, amount, quantity, size, status });

    // Validate required fields
    if (!timestamp || !amount || !quantity || !size || !status) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Parse the service account credentials
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS);
    
    // Create JWT client
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Prepare the values to append
    const values = [[timestamp, amount, quantity, size, status]];

    console.log('Attempting to append to spreadsheet:', {
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
      values
    });

    // Append the values to the spreadsheet
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
      range: 'A:E',
      valueInputOption: 'RAW',
      requestBody: {
        values: values
      }
    });

    console.log('Sheets API Response:', response.data);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Successfully logged to Google Sheets',
        details: response.data
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