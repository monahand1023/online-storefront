<!-- src/views/SuccessView.vue -->
<template>
  <div class="success-container">
    <div class="success-card">
      <div class="success-icon">✓</div>
      <h1>Thank You for Your Order!</h1>
      
      <div v-if="isLoading" class="loading">
        Loading order details...
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
              <span class="value">Event T-Shirt</span>
            </div>
            <div class="info-row">
              <span class="label">Size:</span>
              <span class="value">{{ sessionData?.metadata?.size || 'Not specified' }}</span>
            </div>
            <div class="info-row">
              <span class="label">Quantity:</span>
              <span class="value">{{ sessionData?.metadata?.quantity || '1' }}</span>
            </div>
            <div class="info-row">
              <span class="label">Amount:</span>
              <span class="value">${{ formatAmount(sessionData?.amount_total) }}</span>
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
            <li>You will receive an order confirmation email shortly</li>
            <li>Expected shipping time: 5-7 business days</li>
            <li>Your order will be carefully packaged and shipped to the provided address</li>
            <li>Track your order status in the confirmation email</li>
          </ul>
        </div>

        <div class="contact-info">
          <p>Questions about your order? Contact us at support@japannight.com</p>
        </div>

        <router-link to="/" class="back-button">
          Return to Store
        </router-link>
      </template>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      sessionData: null,
      isLoading: true,
      error: null
    }
  },
  async created() {
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
    } catch (error) {
      console.error('Failed to fetch session details:', error)
      this.error = 'Unable to load order details. Please check your confirmation email.'
    } finally {
      this.isLoading = false
    }
  },
  methods: {
    formatAmount(amount) {
      return ((amount || 0) / 100).toFixed(2)
    },
    formatStatus(status) {
      if (!status) return 'Unknown'
      return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')
    }
  }
}
</script>

<style scoped>
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

h1 {
  color: #2c3e50;
  margin-bottom: 30px;
}

.order-info {
  margin: 30px 0;
  padding: 25px;
  background: #f8f9fa;
  border-radius: 8px;
  text-align: left;
}

h2 {
  color: #2c3e50;
  margin-bottom: 20px;
  font-size: 1.5em;
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.info-row {
  display: grid;
  grid-template-columns: 120px 1fr;
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
</style>