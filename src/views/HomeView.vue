<!-- src/views/HomeView.vue -->
<template>
  <div class="store-container">
    <h1>Event T-Shirts</h1>
    
    <div class="product-card">
      <img src="/shirt-placeholder.jpg" alt="Event T-Shirt" class="product-image">
      <h2>Limited Edition T-Shirt</h2>
      <p class="price">${{ price.toFixed(2) }}</p>
      
      <form @submit.prevent="handleCheckout">
        <div class="product-options">
          <div class="size-selector">
            <label for="size">Size: <span class="required">*</span></label>
            <select 
              v-model="selectedSize" 
              id="size" 
              required
              :class="{ 'error-input': showErrors && !selectedSize }"
            >
              <option value="">Select a size</option>
              <option v-for="size in sizes" :key="size" :value="size">
                {{ size }}
              </option>
            </select>
          </div>
          
          <div class="quantity-selector">
            <label for="quantity">Quantity: <span class="required">*</span></label>
            <select 
              v-model="quantity" 
              id="quantity" 
              required
              :class="{ 'error-input': showErrors && !quantity }"
            >
              <option value="">Select quantity</option>
              <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
            </select>
          </div>
        </div>

        <div class="student-info">
          <div class="form-group">
            <label for="grade">Student's Grade: <span class="required">*</span></label>
            <select 
              v-model="studentGrade" 
              id="grade" 
              required
              :class="{ 'error-input': showErrors && !studentGrade }"
            >
              <option value="">Select grade</option>
              <option v-for="grade in grades" :key="grade" :value="grade">
                {{ grade === 'K' ? 'Kindergarten' : `Grade ${grade}` }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label for="program">Program: <span class="required">*</span></label>
            <select 
              v-model="program" 
              id="program" 
              required
              :class="{ 'error-input': showErrors && !program }"
            >
              <option value="">Select program</option>
              <option v-for="prog in programs" :key="prog" :value="prog">
                {{ prog }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label for="pickupName">Who will pick up the t-shirt? <span class="required">*</span></label>
            <input 
              type="text" 
              id="pickupName" 
              v-model="pickupName" 
              placeholder="Enter full name"
              required
              :class="{ 'error-input': showErrors && !pickupName.trim() }"
            >
          </div>

          <div class="form-group">
            <label for="pickupDate">Pickup Date: <span class="required">*</span></label>
            <select 
              v-model="pickupDate" 
              id="pickupDate" 
              required
              :class="{ 'error-input': showErrors && !pickupDate }"
            >
              <option value="">Select pickup date</option>
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
          type="submit"
          class="checkout-button"
          :disabled="isLoading">
          {{ isLoading ? 'Processing...' : `Checkout (Total: $${calculateTotal()})` }}
        </button>
      </form>
    </div>
  </div>
</template>

<script>
import { loadStripe } from '@stripe/stripe-js'

export default {
  data() {
    return {
      price: 25.00,
      selectedSize: '',
      quantity: '',
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
      stripe: null,
      showErrors: false
    }
  },
  computed: {
    discountApplied() {
      return this.promoCode.trim().toUpperCase() === 'JN-TSHIRT-DISCOUNT'
    }
  },
  async created() {
    try {
      if (!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
        throw new Error('Stripe publishable key is not set');
      }
      this.stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
      if (!this.stripe) {
        throw new Error('Failed to initialize Stripe');
      }
    } catch (error) {
      console.error('Stripe initialization error:', error);
      this.error = 'Failed to initialize payment system. Please refresh the page or try again later.';
    }
  },
  methods: {
    calculateTotal() {
      let total = this.price * (this.quantity || 0)
      if (this.discountApplied) {
        total *= 0.6 // Apply 40% discount
      }
      return total.toFixed(2)
    },
    async handleCheckout() {
      this.showErrors = true;
      
      if (!this.selectedSize || !this.quantity || !this.studentGrade || 
          !this.program || !this.pickupName.trim() || !this.pickupDate) {
        this.error = 'Please fill in all required fields';
        return;
      }

      this.isLoading = true;
      this.error = null;
      
      try {
        if (!this.stripe) {
          throw new Error('Payment system not initialized');
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
            discountApplied: this.discountApplied
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Checkout failed');
        }
        
        const { id: sessionId } = await response.json();
        
        const { error } = await this.stripe.redirectToCheckout({ sessionId });
        
        if (error) {
          throw new Error(error.message);
        }
      } catch (error) {
        console.error('Checkout error:', error);
        this.error = error.message || 'An error occurred during checkout. Please try again.';
      } finally {
        this.isLoading = false;
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
  padding: 30px;
  margin-top: 20px;
}

.product-image {
  width: 100%;
  max-width: 400px;
  height: auto;
  margin-bottom: 20px;
}

.price {
  font-size: 28px;
  font-weight: bold;
  color: #333;
  margin: 20px 0;
}

.product-options {
  display: flex;
  gap: 40px;
  margin: 30px 0;
}

.size-selector,
.quantity-selector {
  flex: 1;
}

.student-info {
  margin: 30px 0;
  padding: 30px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #f9f9f9;
}

.form-group {
  margin-bottom: 25px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 10px;
  font-weight: 500;
  font-size: 1.1em;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1em;
  background-color: #fff;
}

select {
  appearance: none;
  background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23666%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.4-12.8z%22%2F%3E%3C%2Fsvg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 12px;
  padding-right: 30px;
}

.required {
  color: #dc3545;
  margin-left: 4px;
  font-size: 0.9em;
}

.error-input {
  border-color: #dc3545 !important;
  background-color: #fff8f8;
}

.error-message {
  color: #dc3545;
  padding: 15px;
  margin: 20px 0;
  background: #f8d7da;
  border-radius: 4px;
  border: 1px solid #dc3545;
}

.discount-message {
  color: #4CAF50;
  padding: 10px;
  margin: 10px 0;
  border: 1px solid #4CAF50;
  border-radius: 4px;
  background-color: #e8f5e9;
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
  margin-top: 20px;
}

.checkout-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.checkout-button:not(:disabled):hover {
  background-color: #45a049;
}
</style>