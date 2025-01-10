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

      <div class="student-info">
        <div class="form-group">
          <label for="grade">Student's Grade:</label>
          <select v-model="studentGrade" id="grade">
            <option v-for="grade in grades" :key="grade" :value="grade">
              {{ grade === 'K' ? 'Kindergarten' : `Grade ${grade}` }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="program">Program:</label>
          <select v-model="program" id="program">
            <option v-for="prog in programs" :key="prog" :value="prog">
              {{ prog }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="pickupName">Who will pick up the t-shirt?</label>
          <input 
            type="text" 
            id="pickupName" 
            v-model="pickupName" 
            placeholder="Enter full name"
            required
          >
        </div>

        <div class="form-group">
          <label for="pickupDate">Pickup Date:</label>
          <select v-model="pickupDate" id="pickupDate">
            <option v-for="date in pickupDates" :key="date" :value="date">
              {{ date }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="promoCode">Promo Code:</label>
          <input 
            type="text" 
            id="promoCode" 
            v-model="promoCode" 
            placeholder="Enter promo code"
          >
        </div>
      </div>
      
      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <div v-if="discountApplied" class="discount-message">
        40% discount applied!
      </div>

      <button 
        @click="handleCheckout" 
        class="checkout-button"
        :disabled="isLoading || !isFormValid">
        {{ isLoading ? 'Processing...' : `Checkout (Total: $${calculateTotal()})` }}
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
      grades: ['K', '1', '2', '3', '4', '5'],
      programs: ['Spanish', 'Japanese'],
      pickupDates: ['2/15', '2/16', '2/17'],
      studentGrade: '',
      program: '',
      pickupName: '',
      pickupDate: '',
      promoCode: '',
      isLoading: false,
      error: null,
      stripePromise: null
    }
  },
  computed: {
    discountApplied() {
      return this.promoCode.trim().toUpperCase() === 'JN-TSHIRT-DISCOUNT'
    },
    isFormValid() {
      return this.studentGrade && 
             this.program && 
             this.pickupName.trim() && 
             this.pickupDate
    }
  },
  created() {
    console.log('Initializing Stripe with key:', import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
    this.stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
    if (!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
      console.error('Stripe publishable key is not set in environment variables');
    }
  },
  methods: {
    calculateTotal() {
      let total = this.price * this.quantity
      if (this.discountApplied) {
        total *= 0.6 // Apply 40% discount
      }
      return total.toFixed(2)
    },
    async handleCheckout() {
      if (!this.isFormValid) {
        this.error = 'Please fill in all required fields'
        return
      }

      this.isLoading = true
      this.error = null
      
      try {
        if (!this.stripePromise) {
          throw new Error('Payment system not initialized')
        }

        const response = await fetch('/.netlify/functions/create-checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            quantity: this.quantity,
            size: this.selectedSize,
            studentGrade: this.studentGrade,
            program: this.program,
            pickupName: this.pickupName,
            pickupDate: this.pickupDate,
            promoCode: this.promoCode,
            discountApplied: this.discountApplied
          }),
        })
        
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Checkout failed: ${errorText}`)
        }
        
        const session = await response.json()
        
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
/* Existing styles remain the same */

.student-info {
  margin: 20px 0;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #f9f9f9;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.discount-message {
  color: #4CAF50;
  padding: 10px;
  margin: 10px 0;
  border: 1px solid #4CAF50;
  border-radius: 4px;
  background-color: #e8f5e9;
}
</style>