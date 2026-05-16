<!-- src/views/SuccessView.vue -->
<template>
  <div class="success-container">
    <div class="success-card">
      <div class="success-icon">✓</div>
      <h1>Thank You for Your Order!</h1>

      <div v-if="isLoading" class="loading">
        Loading order details for your confirmation. One moment please...
      </div>

      <div v-else-if="error" class="error-message">
        {{ error }}
      </div>

      <template v-else>
        <div class="order-info">
          <h2>Order Summary</h2>
          <div class="info-grid">
            <div class="info-row">
              <span class="label">Product:</span>
              <span class="value">Japan Night T-Shirt</span>
            </div>
            <div class="info-row items-section">
              <span class="label">Orders:</span>
              <div class="value items-list">
                <div v-for="(item, index) in orderItems" :key="index" class="order-item">
                  {{ item }}
                </div>
              </div>
            </div>
             <div class="info-row">
              <span class="label">Amount:</span>
              <span class="value">
                <template v-if="sessionData?.metadata?.discountApplied === 'true'">
                  <!-- Reconstruct pre-discount price: divide final total by 0.6 (discount factor) -->
                  <span class="original-price">${{ formatAmount(sessionData?.amount_total / 0.6) }}</span>
                  <span class="final-price">${{ formatAmount(sessionData?.amount_total) }}</span>
                  <span class="discount-tag">40% Off</span>
                </template>
                <template v-else>
                  ${{ formatAmount(sessionData?.amount_total) }}
                </template>
              </span>
            </div>
            <div class="info-row">
              <span class="label">Student Grade:</span>
              <span class="value">{{ formatGrade(sessionData?.metadata?.studentGrade) }}</span>
            </div>
            <div class="info-row">
              <span class="label">Program:</span>
              <span class="value">{{ sessionData?.metadata?.program || 'Not specified' }}</span>
            </div>
            <div class="info-row">
              <span class="label">Pickup Person:</span>
              <span class="value">{{ sessionData?.metadata?.pickupName || 'Not specified' }}</span>
            </div>
            <div class="info-row">
              <span class="label">Pickup Date:</span>
              <span class="value">{{ sessionData?.metadata?.pickupDate || 'Not specified' }}</span>
            </div>
            <div class="info-row">
              <span class="label">Discount Applied:</span>
              <span class="value">{{ sessionData?.metadata?.discountApplied === 'true' ? 'Yes (40% off)' : 'No' }}</span>
            </div>
            <div class="info-row">
              <span class="label">Email:</span>
              <span class="value">{{ sessionData?.customer_details?.email || 'Not provided' }}</span>
            </div>
            <div class="info-row">
              <span class="label">Order Status:</span>
              <span class="value status">{{ formatStatus(sessionData?.payment_status) }}</span>
            </div>
          </div>
        </div>

        <div class="next-steps">
          <h2>What's Next?</h2>
          <ul>
            <li>You will receive an order confirmation email shortly. Please check your junk folder if you cannot find it.</li>
            <li>Your t-shirts will be available for pickup on your selected date: {{ sessionData?.metadata?.pickupDate || 'specified date' }}</li>
            <li>Please bring ID for verification during pickup</li>
            <li>The pickup person must match the name provided: {{ sessionData?.metadata?.pickupName || 'specified name' }}</li>
          </ul>
        </div>

        <div class="contact-info">
          <p>Questions about your order? Contact us at japan.night.shirts@gmail.com</p>
        </div>

        <router-link to="/" class="back-button">
          Return to Store
        </router-link>
      </template>
    </div>
  </div>
</template>

<script>
// Post-payment actions (email, logging) are handled by the Stripe webhook

export default {
  data() {
    return {
      sessionData: null,
      isLoading: true,
      error: null,
      orderItems: []
    }
  },
  async created() {
    await this.fetchSession()
  },
  methods: {
    async fetchSession() {
      const sessionId = new URLSearchParams(window.location.search).get('session_id')

      if (!sessionId) {
        this.error = 'No order information available'
        this.isLoading = false
        return
      }

      try {
        const response = await fetch(`/.netlify/functions/get-session?session_id=${sessionId}`)
        if (!response.ok) {
          throw new Error('Failed to load order details')
        }

        this.sessionData = await response.json()

        // Parse the order summary into readable format
        if (this.sessionData.metadata?.ordersSummary) {
          this.orderItems = this.sessionData.metadata.ordersSummary.split(', ').map(order => {
            const [quantity, size] = order.split('x ').map(part => part.trim())
            return `${quantity} × Size ${size}`
          })
        }
      } catch (error) {
        console.error('Failed to fetch session details:', error)
        this.error = 'Unable to load order details. Please check your confirmation email.'
      } finally {
        this.isLoading = false
      }
    },
    formatAmount(amount) {
      return ((amount || 0) / 100).toFixed(2)
    },
    formatStatus(status) {
      if (!status) return 'Unknown'
      return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')
    },
    formatGrade(grade) {
      if (!grade) return 'Not specified'
      return grade === 'K' ? 'Kindergarten' : `Grade ${grade}`
    }
  }
}
</script>

<style scoped>
/* Keep all existing styles */
.success-container {
  max-width: 600px;
  margin: 40px auto;
  padding: 0 20px;
}

.success-card {
  background: white;
  border-radius: 8px;
  padding: 40px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.success-icon {
  background: #4CAF50;
  color: white;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  margin: 0 auto 20px;
}

.loading {
  color: #666;
  margin: 20px 0;
  font-style: italic;
}

.error-message {
  color: #dc3545;
  padding: 15px;
  margin: 20px 0;
  background: #f8d7da;
  border-radius: 4px;
  border: 1px solid #dc3545;
}

.order-info {
  margin: 30px 0;
  padding: 25px;
  background: #f8f9fa;
  border-radius: 8px;
  text-align: left;
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.info-row {
  display: grid;
  grid-template-columns: 140px 1fr;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.info-row:last-child {
  border-bottom: none;
}

.label {
  color: #666;
  font-weight: 600;
}

.value {
  color: #2c3e50;
}

.value.status {
  color: #4CAF50;
  font-weight: 600;
}

.next-steps {
  margin: 30px 0;
  text-align: left;
}

.next-steps ul {
  list-style-type: none;
  padding: 0;
}

.next-steps li {
  margin: 10px 0;
  padding-left: 24px;
  position: relative;
  color: #666;
}

.next-steps li::before {
  content: "•";
  position: absolute;
  left: 8px;
  color: #4CAF50;
}

.contact-info {
  margin: 30px 0;
  padding: 15px;
  background: #e9ecef;
  border-radius: 4px;
  font-size: 0.9em;
  color: #666;
}

.back-button {
  display: inline-block;
  background: #4CAF50;
  color: white;
  padding: 12px 24px;
  border-radius: 4px;
  text-decoration: none;
  transition: background-color 0.3s;
  margin-top: 20px;
}

.back-button:hover {
  background: #45a049;
}

/* Styles for multiple orders display */
.items-section {
  align-items: flex-start !important;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.order-item {
  padding: 4px 8px;
  background-color: #f8f9fa;
  border-radius: 4px;
  font-weight: 500;
}

.original-price {
  text-decoration: line-through;
  color: #666;
  margin-right: 8px;
}

.final-price {
  color: #4CAF50;
  font-weight: bold;
}

.discount-tag {
  background: #4CAF50;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8em;
  margin-left: 8px;
}
</style>
