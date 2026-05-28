/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

// ---------------------------------------------------------------------------
// Minimal router so router-link in sub-components doesn't error
// ---------------------------------------------------------------------------
const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: '/', component: HomeView }],
})

// ---------------------------------------------------------------------------
// Mock @stripe/stripe-js so the component doesn't hit the network
// ---------------------------------------------------------------------------
vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn().mockResolvedValue({
    redirectToCheckout: vi.fn().mockResolvedValue({ error: null }),
  }),
}))

// Provide a fake VITE_STRIPE_PUBLISHABLE_KEY so the component doesn't
// throw "Stripe publishable key is not set" during created()
// @ts-ignore
import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY = 'pk_test_fake_key'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mountHome() {
  return mount(HomeView, {
    global: { plugins: [router] },
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HomeView — form structure', () => {
  it('renders size and quantity selects for the default shirt order', () => {
    const wrapper = mountHome()
    expect(wrapper.find('select[id="size-0"]').exists()).toBe(true)
    expect(wrapper.find('select[id="quantity-0"]').exists()).toBe(true)
  })

  it('renders a student grade selector', () => {
    const wrapper = mountHome()
    expect(wrapper.find('select#grade').exists()).toBe(true)
  })

  it('renders a program selector', () => {
    const wrapper = mountHome()
    expect(wrapper.find('select#program').exists()).toBe(true)
  })

  it('renders a pickup name input', () => {
    const wrapper = mountHome()
    expect(wrapper.find('input#pickupName').exists()).toBe(true)
  })

  it('renders a pickup date selector', () => {
    const wrapper = mountHome()
    expect(wrapper.find('select#pickupDate').exists()).toBe(true)
  })

  it('renders a promo code input field', () => {
    const wrapper = mountHome()
    expect(wrapper.find('input#promoCode').exists()).toBe(true)
  })
})

describe('HomeView — submit button disabled state', () => {
  it('is disabled when no items are in cart (totalQuantity === 0)', () => {
    const wrapper = mountHome()
    const submitBtn = wrapper.find('button[type="submit"]')
    // In happy-dom the disabled attribute is present as empty string
    expect((submitBtn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows "Add items to cart" text when totalQuantity is 0', () => {
    const wrapper = mountHome()
    const submitBtn = wrapper.find('button[type="submit"]')
    expect(submitBtn.text()).toBe('Add items to cart')
  })

  it('is NOT disabled and shows price when size and quantity are selected', async () => {
    const wrapper = mountHome()
    // Select size M and quantity 1 for the first order
    await wrapper.find('select[id="size-0"]').setValue('M')
    await wrapper.find('select[id="quantity-0"]').setValue('1')
    await wrapper.vm.$nextTick()
    const submitBtn = wrapper.find('button[type="submit"]')
    // In happy-dom, disabled attr is '' when disabled; check the element property instead
    expect((submitBtn.element as HTMLButtonElement).disabled).toBe(false)
    expect(submitBtn.text()).toContain('$25.00')
  })
})

describe('HomeView — add / remove shirt orders', () => {
  it('adds a second shirt order when the add button is clicked', async () => {
    const wrapper = mountHome()
    await wrapper.find('button.add-shirt-button').trigger('click')
    expect(wrapper.find('select[id="size-1"]').exists()).toBe(true)
    expect(wrapper.find('select[id="quantity-1"]').exists()).toBe(true)
  })

  it('shows a Remove button only when there are multiple shirt orders', async () => {
    const wrapper = mountHome()
    // Initially one order — no Remove button
    expect(wrapper.find('button.remove-button').exists()).toBe(false)
    await wrapper.find('button.add-shirt-button').trigger('click')
    expect(wrapper.find('button.remove-button').exists()).toBe(true)
  })

  it('removes a shirt order when Remove is clicked', async () => {
    const wrapper = mountHome()
    await wrapper.find('button.add-shirt-button').trigger('click')
    expect(wrapper.findAll('select[id^="size-"]').length).toBe(2)
    await wrapper.find('button.remove-button').trigger('click')
    expect(wrapper.findAll('select[id^="size-"]').length).toBe(1)
  })
})

describe('HomeView — order summary', () => {
  it('is hidden when no items are selected', () => {
    const wrapper = mountHome()
    expect(wrapper.find('.order-summary').exists()).toBe(false)
  })

  it('appears once size and quantity are selected', async () => {
    const wrapper = mountHome()
    await wrapper.find('select[id="size-0"]').setValue('L')
    await wrapper.find('select[id="quantity-0"]').setValue('2')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.order-summary').exists()).toBe(true)
    expect(wrapper.find('.summary-total').text()).toContain('2')
  })
})

describe('HomeView — promo code field', () => {
  it('is always visible (not behind a toggle)', () => {
    const wrapper = mountHome()
    expect(wrapper.find('input#promoCode').exists()).toBe(true)
  })

  it('accepts user input into the promoCode model', async () => {
    const wrapper = mountHome()
    await wrapper.find('input#promoCode').setValue('JAPAN40')
    expect((wrapper.vm as InstanceType<typeof HomeView>).promoCode).toBe('JAPAN40')
  })
})

describe('HomeView — error state when checkout API fails', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows an error message when the checkout API returns a non-ok response', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Checkout failed' }),
    })

    const wrapper = mountHome()
    // Allow the async created() hook (Stripe init) to complete
    await new Promise(r => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    // Fill required fields using string values to match <option value="...">
    await wrapper.find('select[id="size-0"]').setValue('M')
    await wrapper.find('select[id="quantity-0"]').setValue('1')
    await wrapper.find('select#grade').setValue('3')
    await wrapper.find('select#program').setValue('Japanese')
    await wrapper.find('input#pickupName').setValue('Jane Doe')
    await wrapper.find('select#pickupDate').setValue('2/15')
    await wrapper.vm.$nextTick()

    await wrapper.find('form').trigger('submit')

    // Wait for async handleCheckout
    await new Promise(r => setTimeout(r, 10))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.error-message').exists()).toBe(true)
    expect(wrapper.find('.error-message').text()).toContain('Checkout failed')
  })

  it('shows an error message when fetch throws a network error', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'))

    const wrapper = mountHome()
    // Allow the async created() hook (Stripe init) to complete
    await new Promise(r => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    await wrapper.find('select[id="size-0"]').setValue('S')
    await wrapper.find('select[id="quantity-0"]').setValue('1')
    await wrapper.find('select#grade').setValue('K')
    await wrapper.find('select#program').setValue('Spanish')
    await wrapper.find('input#pickupName').setValue('John Smith')
    await wrapper.find('select#pickupDate').setValue('2/16')
    await wrapper.vm.$nextTick()

    await wrapper.find('form').trigger('submit')
    await new Promise(r => setTimeout(r, 10))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.error-message').exists()).toBe(true)
    expect(wrapper.find('.error-message').text()).toContain('Network error')
  })

  it('shows required-field error without calling fetch when fields are empty', async () => {
    const wrapper = mountHome()
    // Don't fill any fields — just submit
    await wrapper.find('form').trigger('submit')
    await wrapper.vm.$nextTick()

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(wrapper.find('.error-message').exists()).toBe(true)
    expect(wrapper.find('.error-message').text()).toContain('required fields')
  })
})

describe('HomeView — sanitizeString behavior via UI', () => {
  it('picks up user-typed promo code and passes it through via the component model', async () => {
    const wrapper = mountHome()
    // The component passes promoCode directly to the API request body.
    // Verify the model correctly captures what the user types.
    await wrapper.find('input#promoCode').setValue('  japan40  ')
    expect((wrapper.vm as InstanceType<typeof HomeView>).promoCode).toBe('  japan40  ')
  })
})
