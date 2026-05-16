// src/services/googleSheetsLogger.ts
// NOTE: Email and logging are now primarily handled by the Stripe webhook
// (netlify/functions/stripe-webhook.js). This service is kept as a fallback
// but is no longer called from SuccessView.vue.

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
      hour12: false,
    }).replace(',', '');
  }

  /**
   * Derive a stable, deterministic order ID from the Stripe session ID.
   * Uses the last 16 characters of the session ID (after stripping the cs_/cs_test_ prefix)
   * so that all rows from the same order share the same ID even if the logger
   * is called multiple times.
   */
  private deriveOrderId(sessionId: string): string {
    const stripped = sessionId.replace('cs_test_', '').replace('cs_', '');
    return `JN-${stripped.slice(-16).toUpperCase()}`;
  }

  async logTransaction(
    transaction: Omit<Transaction, 'timestamp'>,
    orderSummary: string[],
    sessionId?: string,
  ): Promise<void> {
    try {
      console.log('Attempting to log transaction...');
      const timestamp = this.formatDate(new Date());
      const orderId = sessionId
        ? this.deriveOrderId(sessionId)
        : `JN-${Date.now().toString(36).toUpperCase()}`;

      // Calculate total quantity and price per shirt
      const totalQuantity = orderSummary.reduce((sum, order) => {
        const qty = parseInt(order.split('x ')[0].trim()) || 0;
        return sum + qty;
      }, 0);

      const pricePerShirt = totalQuantity > 0 ? transaction.amount / totalQuantity : transaction.amount;

      // Create separate log entries for each size with proportional amounts
      const orders = orderSummary.map(order => {
        const [qtyStr, size] = order.split('x ').map(part => part.trim());
        const itemQuantity = parseInt(qtyStr) || 1;
        const itemAmount = pricePerShirt * itemQuantity;

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
          discountApplied: transaction.discountApplied,
        };
      });

      // Log each size as a separate row
      for (const order of orders) {
        await fetch(this.SHEETS_API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
