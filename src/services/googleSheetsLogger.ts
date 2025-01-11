// src/services/googleSheetsLogger.ts

interface Transaction {
  timestamp: string;
  amount: number;
  quantity: number;
  size: string;
  status: string;
  studentGrade?: string;
  program?: string;
  pickupName?: string;
  pickupDate?: string;
  discountApplied?: boolean;
  email?: string;
  orderId?: string;
  customerName?: string;
}

class GoogleSheetsLogger {
  private readonly SHEETS_API_ENDPOINT: string;

  constructor() {
    this.SHEETS_API_ENDPOINT = '/.netlify/functions/log-to-sheets';
  }

  private formatDate(date: Date): string {
    return date.toLocaleString('en-GB', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).replace(',', '');
  }

  async logTransaction(transaction: Omit<Transaction, 'timestamp'>, orderSummary: string[]): Promise<void> {
    try {
      console.log('Attempting to log transaction...');
      const timestamp = this.formatDate(new Date());
      const orderId = `JN-${Date.now().toString(36).toUpperCase()}`;
      
      // Calculate total quantity and price per shirt
      const totalQuantity = orderSummary.reduce((sum, order) => {
        const [quantity] = order.split('x ').map(part => parseInt(part.trim()));
        return sum + quantity;
      }, 0);
      
      const pricePerShirt = transaction.amount / totalQuantity;
      
      // Create separate log entries for each size with proportional amounts
      const orders = orderSummary.map(order => {
        const [quantity, size] = order.split('x ').map(part => part.trim());
        const itemQuantity = parseInt(quantity);
        const itemAmount = pricePerShirt * itemQuantity; // Amount for this size based on quantity

        return {
          timestamp,
          orderId,
          amount: itemAmount,
          quantity: itemQuantity,
          size,
          status: transaction.status,
          email: transaction.email || 'Not provided',
          customerName: transaction.customerName || 'Not provided',
          studentGrade: transaction.studentGrade,
          program: transaction.program,
          pickupName: transaction.pickupName,
          pickupDate: transaction.pickupDate,
          discountApplied: transaction.discountApplied
        };
      });

      // Log each size as a separate row
      for (const order of orders) {
        await fetch(this.SHEETS_API_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(order),
        });
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