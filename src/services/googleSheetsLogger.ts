// src/services/googleSheetsLogger.ts

interface Transaction {
  timestamp: string;
  amount: number;
  quantity: number;
  size: string;
  status: string;
}

class GoogleSheetsLogger {
  private readonly SHEETS_API_ENDPOINT: string;
  private readonly SPREADSHEET_ID: string;
  private readonly API_KEY: string;

  constructor() {
    this.SHEETS_API_ENDPOINT = 'https://sheets.googleapis.com/v4/spreadsheets';
    this.SPREADSHEET_ID = import.meta.env.VITE_GOOGLE_SPREADSHEET_ID;
    this.API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

    // Make these available for debugging
    window._GOOGLE_SHEETS_CONFIG = {
      SPREADSHEET_ID: this.SPREADSHEET_ID,
      API_KEY: this.API_KEY ? 'Set' : 'Missing'
    };
  }

  // Add a test method that can be called from the console
  async testConnection(): Promise<void> {
    try {
      if (!this.SPREADSHEET_ID || !this.API_KEY) {
        throw new Error('Missing required configuration (SPREADSHEET_ID or API_KEY)');
      }

      // Try to get spreadsheet metadata
      const url = `${this.SHEETS_API_ENDPOINT}/${this.SPREADSHEET_ID}?key=${this.API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(`API Error: ${data.error?.message || response.statusText}`);
      }

      console.log('Successfully connected to spreadsheet:', {
        title: data.properties?.title,
        sheets: data.sheets?.length,
        spreadsheetId: data.spreadsheetId
      });
      
      return data;
    } catch (error) {
      console.error('Connection test failed:', error);
      throw error;
    }
  }

  async logTransaction(transaction: Omit<Transaction, 'timestamp'>): Promise<void> {
    try {
      if (!this.SPREADSHEET_ID || !this.API_KEY) {
        throw new Error('Missing required configuration (SPREADSHEET_ID or API_KEY)');
      }

      const values = [
        [
          new Date().toISOString(),
          transaction.amount,
          transaction.quantity,
          transaction.size,
          transaction.status
        ]
      ];

      const url = `${this.SHEETS_API_ENDPOINT}/${this.SPREADSHEET_ID}/values/A:E:append?valueInputOption=RAW&key=${this.API_KEY}`;
      
      console.log('Attempting to log transaction to Google Sheets...');
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: values,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(`Failed to log transaction: ${responseData.error?.message || response.statusText}`);
      }

      console.log('Transaction successfully logged to Google Sheets:', {
        updatedRange: responseData.updates?.updatedRange,
        updatedRows: responseData.updates?.updatedRows
      });
    } catch (error) {
      console.error('Error logging transaction:', error);
      throw error;
    }
  }
}

// Create and export a singleton instance
export const googleSheetsLogger = new GoogleSheetsLogger();

// Make the logger available globally for testing
declare global {
  interface Window {
    _GOOGLE_SHEETS_CONFIG: {
      SPREADSHEET_ID: string;
      API_KEY: string;
    };
    googleSheetsLogger: typeof googleSheetsLogger;
  }
}

window.googleSheetsLogger = googleSheetsLogger;