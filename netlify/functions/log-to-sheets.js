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
      discountApplied 
    } = JSON.parse(event.body);

    // Validate required fields
    if (!timestamp || !amount || !quantity || !size || !status) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS);
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Prepare the values to append (expanded with new fields)
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
      discountApplied ? 'Yes' : 'No'
    ]];

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
      range: 'A:M', // Updated range to include new columns
      valueInputOption: 'RAW',
      requestBody: {
        values: values
      }
    });

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