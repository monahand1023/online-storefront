<!-- src/views/HomeView.vue -->
<template>
  <div class="store-container">
    <h1>Event T-Shirts</h1>
    
    <div class="product-card">
      <img src="/shirt-placeholder.jpg" alt="Event T-Shirt" class="product-image">
      <h2>Limited Edition T-Shirt</h2>
      <p class="price">${{ price.toFixed(2) }}</p>
      
      <div class="product-options">
        <div class="size-selector">
          <label for="size">Size:</label>
          <select v-model="selectedSize" id="size">
            <option v-for="size in sizes" :key="size" :value="size">
              {{ size }}
            </option>
          </select>
        </div>
        
        <div class="quantity-selector">
          <label for="quantity">Quantity:</label>
          <select v-model="quantity" id="quantity">
            <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
          </select>
        </div>
      </div>
      
      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <button 
        @click="handleCheckout" 
        class="checkout-button"
        :disabled="isLoading">
        {{ isLoading ? 'Processing...' : `Checkout (Total: $${(price * quantity).toFixed(2)})` }}
      </button>
    </div>
  </div>
</template>

<script>
import { loadStripe } from '@stripe/stripe-js'

export default {
  data() {
    return {
      price: 25.00,
      selectedSize: 'M',
      quantity: 1,
      sizes: ['S', 'M', 'L', 'XL'],
      isLoading: false,
      error: null,
      stripePromise: null
    }
  },
  async created() {
    try {
      this.stripePromise = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
      if (!this.stripePromise) {
        throw new Error('Failed to initialize Stripe')
      }
    } catch (error) {
      console.error('Stripe initialization error:', error)
      this.error = 'Failed to initialize payment system'
    }
  },
  methods: {
    async handleCheckout() {
      this.isLoading = true
      this.error = null
      
      try {
        if (!this.stripePromise) {
          throw new Error('Payment system not initialized')
        }

        console.log('Creating checkout session...')
        const response = await fetch('/.netlify/functions/create-checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            quantity: this.quantity,
            size: this.selectedSize,
          }),
        })
        
        console.log('Response status:', response.status)
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error('Checkout error response:', errorText)
          throw new Error(`Checkout failed: ${errorText}`)
        }
        
        const session = await response.json()
        console.log('Session created:', session)
        
        // Redirect to Stripe Checkout
        const result = await this.stripePromise.redirectToCheckout({
          sessionId: session.id
        })
        
        if (result.error) {
          throw new Error(result.error.message)
        }
      } catch (error) {
        console.error('Checkout error:', error)
        this.error = error.message
      } finally {
        this.isLoading = false
      }
    }
  }
}
</script>

<style scoped>
.store-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.product-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
}

.product-image {
  width: 100%;
  max-width: 400px;
  height: auto;
  margin-bottom: 20px;
}

.price {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.product-options {
  margin: 20px 0;
  display: flex;
  gap: 20px;
}

.size-selector,
.quantity-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

select {
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.checkout-button {
  background-color: #4CAF50;
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  width: 100%;
  font-size: 16px;
}

.checkout-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.checkout-button:not(:disabled):hover {
  background-color: #45a049;
}

.error-message {
  color: #dc3545;
  padding: 10px;
  margin: 10px 0;
  border: 1px solid #dc3545;
  border-radius: 4px;
  background-color: #f8d7da;
}
</style>