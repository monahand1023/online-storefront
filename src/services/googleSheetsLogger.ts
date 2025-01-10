// src/services/googleSheetsLogger.ts

interface Transaction {
  timestamp: string;
  amount: number;
  quantity: number;
  size: string;
  status: string;
}

export class GoogleSheetsLogger {
  private readonly SHEETS_API_ENDPOINT: string;
  private readonly SPREADSHEET_ID: string;
  private readonly API_KEY: string;

  constructor() {
    this.SHEETS_API_ENDPOINT = 'https://sheets.googleapis.com/v4/spreadsheets';
    this.SPREADSHEET_ID = import.meta.env.VITE_GOOGLE_SPREADSHEET_ID;
    this.API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
  }

  async logTransaction(transaction: Omit<Transaction, 'timestamp'>): Promise<void> {
    try {
      const values = [
        [
          new Date().toISOString(),
          transaction.amount,
          transaction.quantity,
          transaction.size,
          transaction.status
        ]
      ];

      const response = await fetch(
        `${this.SHEETS_API_ENDPOINT}/${this.SPREADSHEET_ID}/values/A:E:append?valueInputOption=RAW&key=${this.API_KEY}`,
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
        throw new Error(`Failed to log transaction: ${response.statusText}`);
      }

      console.log('Transaction logged successfully to Google Sheets');
    } catch (error) {
      console.error('Error logging transaction:', error);
      throw error;
    }
  }
}

export const googleSheetsLogger = new GoogleSheetsLogger();