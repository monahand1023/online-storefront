<!-- src/views/HomeView.vue -->
<template>
  <div class="store-container">
    <h1>Japan Night T-Shirts</h1>
    
    <div class="product-card">
      <img src="/shirt-placeholder.jpg" alt="Japan Night T-Shirt" class="product-image">
      <h2>Limited Edition T-Shirt</h2>
      <p class="price">${{ price.toFixed(2) }} each</p>
      
      <form @submit.prevent="handleCheckout">
        <!-- Multiple shirt orders section -->
        <div class="shirt-orders">
          <div v-for="(order, index) in shirtOrders" :key="index" class="shirt-order">
            <div class="order-header">
              <h3>Shirt Order #{{ index + 1 }}</h3>
              <button 
                v-if="shirtOrders.length > 1" 
                type="button" 
                class="remove-button"
                @click="removeShirtOrder(index)"
              >
                Remove
              </button>
            </div>
            
            <div class="product-options">
              <div class="size-selector">
                <label :for="'size-' + index">Size: <span class="required">*</span></label>
                <select 
                  v-model="order.size" 
                  :id="'size-' + index" 
                  required
                  :class="{ 'error-input': showErrors && !order.size }"
                >
                  <option value="">Select a size</option>
                  <option v-for="size in sizes" :key="size" :value="size">
                    {{ size }}
                  </option>
                </select>
              </div>
              
              <div class="quantity-selector">
                <label :for="'quantity-' + index">Quantity: <span class="required">*</span></label>
                <select 
                  v-model="order.quantity" 
                  :id="'quantity-' + index" 
                  required
                  :class="{ 'error-input': showErrors && !order.quantity }"
                >
                  <option value="">Select quantity</option>
                  <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <button 
          type="button" 
          class="add-shirt-button"
          @click="addShirtOrder"
        >
          + Add Another Shirt Size To Order
        </button>

        <!-- Order summary -->
        <div class="order-summary" v-if="totalQuantity > 0">
          <h3>Order Summary</h3>
          <div class="summary-items">
            <div v-for="(order, index) in shirtOrders" :key="index" class="summary-item">
              <template v-if="order.size && order.quantity">
                {{ order.quantity }}x Size {{ order.size }}
              </template>
            </div>
          </div>
          <div class="summary-total">
            Total Items: {{ totalQuantity }}
          </div>
        </div>

        <!-- Student and pickup information -->
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

        <button
          type="submit"
          class="checkout-button"
          :disabled="isLoading || totalQuantity === 0">
          {{ checkoutButtonText }}
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
      sizes: ['S', 'M', 'L', 'XL'],
      grades: ['K', '1', '2', '3', '4', '5'],
      programs: ['Spanish', 'Japanese'],
      pickupDates: ['2/15', '2/16', '2/17'],
      shirtOrders: [
        { size: '', quantity: '' }
      ],
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
    totalQuantity() {
      return this.shirtOrders.reduce((sum, order) => sum + (parseInt(order.quantity) || 0), 0)
    },
    subtotal() {
      return this.totalQuantity * this.price
    },
    checkoutButtonText() {
      if (this.isLoading) return 'Processing...'
      if (this.totalQuantity === 0) return 'Add items to cart'
      return `Checkout (Total: $${this.subtotal.toFixed(2)})`
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
    addShirtOrder() {
      this.shirtOrders.push({ size: '', quantity: '' });
    },
    removeShirtOrder(index) {
      this.shirtOrders.splice(index, 1);
    },
    validateOrders() {
      return this.shirtOrders.every(order => order.size && order.quantity) &&
             this.totalQuantity > 0;
    },
    async handleCheckout() {
      this.showErrors = true;
      
      if (!this.validateOrders() || !this.studentGrade || 
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
            orders: this.shirtOrders,
            studentGrade: this.studentGrade,
            program: this.program,
            pickupName: this.pickupName,
            pickupDate: this.pickupDate,
            promoCode: this.promoCode
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

.shirt-orders {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.shirt-order {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  background-color: #fff;
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.order-header h3 {
  margin: 0;
  font-size: 1.1em;
  color: #333;
}

.remove-button {
  padding: 6px 12px;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
}

.remove-button:hover {
  background-color: #c82333;
}

.add-shirt-button {
  width: 100%;
  padding: 12px;
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin: 20px 0;
  font-size: 1em;
}

.add-shirt-button:hover {
  background-color: #5a6268;
}

.order-summary {
  margin: 20px 0;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.order-summary h3 {
  margin: 0 0 15px 0;
  color: #333;
}

.summary-items {
  margin-bottom: 10px;
}

.summary-item {
  padding: 5px 0;
  color: #495057;
}

.summary-total {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #dee2e6;
  font-weight: bold;
  color: #333;
}

.size-selector,
.quantity-selector {
  flex: 1;
}

.size-selector select,
.quantity-selector select {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1em;
  background-color: #fff;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23666%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.4-12.8z%22%2F%3E%3C%2Fsvg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 12px;
  padding-right: 30px;
}
</style>