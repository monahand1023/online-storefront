<!-- src/views/HomeView.vue -->
<template>
  <div class="store-container">
    <h1>Event T-Shirts</h1>
    
    <div class="product-card">
      <img src="/shirt-placeholder.jpg" alt="Event T-Shirt" class="product-image">
      <h2>Limited Edition T-Shirt</h2>
      <p class="price">${{ price.toFixed(2) }}</p>
      
      <form @submit.prevent="handleCheckout" class="order-form">
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

        <div v-if="validationErrors.length > 0" class="error-message">
          <div>Please fill in all required fields:</div>
          <ul>
            <li v-for="(error, index) in validationErrors" :key="index">
              {{ error }}
            </li>
          </ul>
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
    },
    validationErrors() {
      if (!this.showErrors) return [];
      
      const errors = [];
      if (!this.selectedSize) errors.push('Please select a size');
      if (!this.quantity) errors.push('Please select a quantity');
      if (!this.studentGrade) errors.push('Please select student\'s grade');
      if (!this.program) errors.push('Please select a program');
      if (!this.pickupName.trim()) errors.push('Please enter pickup person\'s name');
      if (!this.pickupDate) errors.push('Please select a pickup date');
      
      return errors;
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
      if (this.validationErrors.length > 0) {
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
/* Previous styles remain the same */

.required {
  color: #dc3545;
  margin-left: 2px;
}

.error-input {
  border-color: #dc3545 !important;
  background-color: #fff8f8;
}

.order-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.error-message ul {
  margin: 10px 0 0 20px;
  padding: 0;
}

.error-message li {
  color: #dc3545;
  margin-top: 5px;
}

/* Rest of your existing styles */
</style>