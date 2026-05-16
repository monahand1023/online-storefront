// Central configuration for store constants.
// Edit this file to change pickup dates, pricing, or available sizes.

export const PRODUCT_NAME = 'Japan Night T-Shirt';

/** Base price in dollars (displayed to user) */
export const BASE_PRICE_DOLLARS = 25.0;

/** Base price in cents (sent to Stripe) */
export const BASE_PRICE_CENTS = 2500;

/** Available shirt sizes shown in the order form */
export const AVAILABLE_SIZES: string[] = ['S', 'M', 'L', 'XL'];

/** Pickup dates shown in the order form */
export const PICKUP_DATES: string[] = ['2/15', '2/16', '2/17'];

/** Student grade options */
export const GRADES: string[] = ['K', '1', '2', '3', '4', '5'];

/** Program options */
export const PROGRAMS: string[] = ['Spanish', 'Japanese'];
