<!-- src/App.vue -->
<template>
  <!-- This is where your router views will be rendered -->
  <router-view></router-view>
</template>

<script>
export default {
  name: 'App'
}
</script>

<style>
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