<!-- src/views/SuccessView.vue -->
<template>
  <div class="success-container">
    <div class="success-card">
      <div class="success-icon">✓</div>
      <h1>Order Confirmed!</h1>
      <p class="message">Thank you for your purchase. Your Event T-Shirt order has been received.</p>
      
      <div class="order-info" v-if="sessionData">
        <h2>Order Details</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">Amount Paid:</span>
            <span class="value">${{ formatAmount(sessionData.amount_total) }}</span>
          </div>
          <div class="info-item">
            <span class="label">Email:</span>
            <span class="value">{{ sessionData.customer_email }}</span>
          </div>
        </div>
      </div>

      <div class="next-steps">
        <h2>What's Next?</h2>
        <p>You will receive an email confirmation shortly with your order details.</p>
        <p>Expected shipping time: 5-7 business days</p>
      </div>

      <router-link to="/" class="back-button">
        Return to Store
      </router-link>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      sessionData: null
    }
  },
  async created() {
    // Get the session_id from URL if Stripe provides it
    const sessionId = new URLSearchParams(window.location.search).get('session_id')
    
    if (sessionId) {
      try {
        // Fetch session details from your serverless function
        const response = await fetch(`/.netlify/functions/get-session?session_id=${sessionId}`)
        if (response.ok) {
          this.sessionData = await response.json()
        }
      } catch (error) {
        console.error('Failed to fetch session details:', error)
      }
    }
  },
  methods: {
    formatAmount(amount) {
      return (amount / 100).toFixed(2)
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

h1 {
  color: #2c3e50;
  margin-bottom: 20px;
}

.message {
  color: #666;
  font-size: 18px;
  margin-bottom: 30px;
}

.order-info {
  margin: 30px 0;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 6px;
}

.info-grid {
  display: grid;
  gap: 15px;
  margin-top: 15px;
}

.info-item {
  display: grid;
  grid-template-columns: 1fr 1fr;
  text-align: left;
}

.label {
  color: #666;
  font-weight: 600;
}

.value {
  color: #2c3e50;
}

.next-steps {
  margin: 30px 0;
  text-align: left;
}

.next-steps h2 {
  margin-bottom: 15px;
  color: #2c3e50;
}

.next-steps p {
  color: #666;
  margin-bottom: 10px;
}

.back-button {
  display: inline-block;
  background: #4CAF50;
  color: white;
  padding: 12px 24px;
  border-radius: 4px;
  text-decoration: none;
  transition: background-color 0.3s;
}

.back-button:hover {
  background: #45a049;
}
</style>