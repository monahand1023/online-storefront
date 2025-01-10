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

  constructor() {
    this.SHEETS_API_ENDPOINT = '/.netlify/functions/log-to-sheets';
  }

  async logTransaction(transaction: Omit<Transaction, 'timestamp'>): Promise<void> {
    try {
      console.log('Attempting to log transaction...');
      
      const response = await fetch(this.SHEETS_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...transaction,
          timestamp: new Date().toISOString()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to log transaction: ${errorData.error || response.statusText}`);
      }

      console.log('Transaction successfully logged to Google Sheets');
    } catch (error) {
      console.error('Error logging transaction:', error);
      throw error;
    }
  }
}

// Create and export a singleton instance
export const googleSheetsLogger = new GoogleSheetsLogger();