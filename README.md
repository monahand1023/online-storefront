# Online Store Documentation

## Overview

This is a Vue.js-based e-commerce application designed for selling products. I originally created this website for my kid's school because they needed an online ordering portal for ordering t-shirts for a school event. After publsihing it, I decided to make it an open-source project so anyone could download, build, and deploy this simple and efficient application for their own online store. The application integrates with Stripe for payments, uses Netlify for hosting and serverless functions, and includes features like email notifications and Google Sheets integration for order tracking.

## Tech Stack

- Frontend: Vue 3 with TypeScript
- Payment Processing: Stripe
- Hosting & Serverless: Netlify
- Email Service: Nodemailer
- Order Tracking: Google Sheets API

## Project Structure
```


├── netlify
│   └── functions/              # Serverless functions
│       ├── create-checkout.js  # Stripe checkout session creation
│       ├── get-session.js      # Retrieve session details
│       ├── log-to-sheets.js    # Google Sheets logging


│       └── send-email.js       # Email notifications
├── src
│   ├── assets/                 # Static assets
│   ├── components/             # Vue components
│   ├── router/                 # Vue Router configuration
│   ├── services/               # Service layer


│   │   └── googleSheetsLogger.ts
│   └── views/                  # Page components
│       ├── HomeView.vue        # Main order form


│       └── SuccessView.vue     # Order confirmation
├── netlify.toml               # Netlify configuration
└── package.json              # Project dependencies
```

## Core Components

### HomeView.vue
- Main ordering interface
- Features:
  - Multiple shirt size/quantity selection
  - Student information collection
  - Pickup details
  - Promo code support (40% discount)
  - Stripe checkout integration

### SuccessView.vue
- Order confirmation page
- Features:
  - Displays order summary
  - Sends confirmation email
  - Logs transaction to Google Sheets
  - Shows pickup instructions

## Serverless Functions

### create-checkout.js
- Creates Stripe checkout session
- Handles:
  - Price calculation with discounts
  - Order metadata collection
  - Multiple item support

### get-session.js
- Retrieves Stripe session details
- Used for order confirmation

### log-to-sheets.js
- Logs order details to Google Sheets
- Tracks:
  - Order details
  - Customer information
  - Payment status
  - Pickup information

### send-email.js
- Sends confirmation emails
- Includes:
  - Order summary
  - Pickup instructions
  - Customer details

## Environment Variables Required
```
STRIPE_SECRET_KEY=           # Stripe secret key
STRIPE_PUBLISHABLE_KEY=      # Stripe publishable key
VITE_STRIPE_PUBLISHABLE_KEY= # Stripe publishable key for frontend
GOOGLE_SERVICE_ACCOUNT_CREDENTIALS= # Google service account JSON
GOOGLE_SPREADSHEET_ID=       # Google Sheets ID
SMTP_HOST=                   # SMTP server host
SMTP_PORT=                   # SMTP server port
SMTP_USER=                   # SMTP username
SMTP_PASSWORD=               # SMTP password
VITE_DISCOUNT_CODE=         # Discount code for 40% off
```

## Deployment Instructions

1. **Prerequisites**
   - Node.js installed
   - Netlify CLI installed
   - Stripe account
   - Google Cloud account with Sheets API enabled
   - SMTP email service

2. **Local Development Setup**
   ```bash
   # Install dependencies
   npm install

   # Create .env file with required variables
   cp .env.example .env

   # Start development server
   npm run dev
   ```

3. **Netlify Deployment**
   ```bash
   # Login to Netlify
   netlify login

   # Initialize Netlify site
   netlify init

   # Deploy
   netlify deploy --prod
   ```

4. **Post-Deployment Setup**
   - Configure environment variables in Netlify dashboard
   - Set up Stripe webhook endpoints
   - Configure Google Sheets API credentials
   - Test email notifications

## Feature Flags and Configurations

### Discount System
- 40% discount available with promo code
- Configured through `VITE_DISCOUNT_CODE` environment variable

### Order Limits
- Maximum 5 shirts per size
- Multiple sizes per order supported

### Pickup Dates
- Configurable pickup dates in `HomeView.vue`

## Data Flow

1. **Order Submission**
   ```
   User Input → Stripe Checkout → Payment Processing
        ↓
   Success Confirmation → Email Notification
        ↓
   Google Sheets Logging
   ```

2. **Data Storage**
   - Order details stored in Stripe metadata
   - Backup logging to Google Sheets
   - Email confirmations sent to both customer and admin

## Security Considerations

- Stripe handles all payment information
- Environment variables protected from secrets scanning
- Server-side validation for all inputs
- CORS and security headers managed by Netlify

## Maintenance and Monitoring

### Order Tracking
- All orders logged to Google Sheets
- Accessible through shared spreadsheet
- Includes payment status and customer details

### Error Handling
- Failed payments tracked in Stripe dashboard
- Email sending failures logged
- Google Sheets logging errors captured

## Future Improvements

1. **Potential Enhancements**
   - Inventory tracking system
   - Size availability management
   - Additional payment methods
   - Multiple pickup location support

2. **Performance Optimizations**
   - Image optimization
   - Component lazy loading
   - Caching strategies

## Support and Contact

For technical issues:
- Check Netlify deployment logs
- Monitor Stripe dashboard for payment issues
- Review Google Sheets for order tracking


