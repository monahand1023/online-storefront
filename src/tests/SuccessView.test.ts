/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import SuccessView from '../views/SuccessView.vue'

// ---------------------------------------------------------------------------
// Minimal router (SuccessView uses <router-link>)
// ---------------------------------------------------------------------------
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/success', component: SuccessView },
  ],
})

// ---------------------------------------------------------------------------
// Helper — builds a realistic Stripe session object
// ---------------------------------------------------------------------------
function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    amount_total: 2500,
    payment_status: 'paid',
    customer_details: { email: 'buyer@example.com', name: 'Jane Doe' },
    metadata: {
      ordersSummary: '1x M',
      studentGrade: '3',
      program: 'Japanese',
      pickupName: 'Jane Doe',
      pickupDate: '2/15',
      discountApplied: 'false',
      original_amount_cents: '2500',
    },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Helper — mount with a mocked window.location.search
// ---------------------------------------------------------------------------
function mountSuccess(sessionId = 'cs_test_abc1234567890') {
  // happy-dom allows setting window.location
  Object.defineProperty(window, 'location', {
    value: { search: `?session_id=${sessionId}` },
    writable: true,
    configurable: true,
  })
  return mount(SuccessView, {
    global: { plugins: [router] },
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SuccessView — loading state', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders a loading message while fetching the session', () => {
    // Return a promise that never resolves so we can observe the loading state
    fetchSpy.mockReturnValue(new Promise(() => {}))
    const wrapper = mountSuccess()
    expect(wrapper.find('.loading').exists()).toBe(true)
    expect(wrapper.find('.loading').text()).toContain('Loading')
  })
})

describe('SuccessView — successful session load', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('displays order details when session loads successfully', async () => {
    const session = makeSession()
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => session,
    })

    const wrapper = mountSuccess()
    await new Promise(r => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    // Loading should be gone
    expect(wrapper.find('.loading').exists()).toBe(false)
    expect(wrapper.find('.error-message').exists()).toBe(false)
    // Order info section should appear
    expect(wrapper.find('.order-info').exists()).toBe(true)
  })

  it('displays the payment amount from the session', async () => {
    const session = makeSession({ amount_total: 5000 })
    fetchSpy.mockResolvedValue({ ok: true, json: async () => session })

    const wrapper = mountSuccess()
    await new Promise(r => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('50.00')
  })

  it('shows student grade from metadata', async () => {
    const session = makeSession()
    fetchSpy.mockResolvedValue({ ok: true, json: async () => session })

    const wrapper = mountSuccess()
    await new Promise(r => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Grade 3')
  })

  it('shows pickup name from metadata', async () => {
    const session = makeSession()
    fetchSpy.mockResolvedValue({ ok: true, json: async () => session })

    const wrapper = mountSuccess()
    await new Promise(r => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Jane Doe')
  })

  it('shows pickup date from metadata', async () => {
    const session = makeSession()
    fetchSpy.mockResolvedValue({ ok: true, json: async () => session })

    const wrapper = mountSuccess()
    await new Promise(r => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('2/15')
  })

  it('parses ordersSummary into readable order items', async () => {
    const session = makeSession({
      metadata: {
        ...makeSession().metadata,
        ordersSummary: '2x M, 1x XL',
      },
    })
    fetchSpy.mockResolvedValue({ ok: true, json: async () => session })

    const wrapper = mountSuccess()
    await new Promise(r => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('2 × Size M')
    expect(wrapper.text()).toContain('1 × Size XL')
  })
})

describe('SuccessView — wasDiscounted computed', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does NOT show original price when discountApplied is "false"', async () => {
    const session = makeSession({
      amount_total: 2500,
      metadata: {
        ...makeSession().metadata,
        discountApplied: 'false',
        original_amount_cents: '2500',
      },
    })
    fetchSpy.mockResolvedValue({ ok: true, json: async () => session })

    const wrapper = mountSuccess()
    await new Promise(r => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.original-price').exists()).toBe(false)
    expect(wrapper.find('.discount-tag').exists()).toBe(false)
  })

  it('shows original price and discount tag when discountApplied is "true"', async () => {
    const session = makeSession({
      amount_total: 1500,  // discounted final: $15
      metadata: {
        ...makeSession().metadata,
        discountApplied: 'true',
        original_amount_cents: '2500',  // original: $25
      },
    })
    fetchSpy.mockResolvedValue({ ok: true, json: async () => session })

    const wrapper = mountSuccess()
    await new Promise(r => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.original-price').exists()).toBe(true)
    expect(wrapper.find('.original-price').text()).toContain('25.00')
    expect(wrapper.find('.final-price').text()).toContain('15.00')
    expect(wrapper.find('.discount-tag').exists()).toBe(true)
    expect(wrapper.find('.discount-tag').text()).toContain('40% Off')
  })

  it('wasDiscounted is false when discountApplied is absent', async () => {
    const session = makeSession({
      metadata: {
        ...makeSession().metadata,
        discountApplied: undefined,
      },
    })
    fetchSpy.mockResolvedValue({ ok: true, json: async () => session })

    const wrapper = mountSuccess()
    await new Promise(r => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.original-price').exists()).toBe(false)
  })

  it('originalAmount falls back to amount_total when original_amount_cents is absent', async () => {
    const session = makeSession({
      amount_total: 2500,
      metadata: {
        ordersSummary: '1x M',
        studentGrade: '1',
        program: 'Spanish',
        pickupName: 'Alice',
        pickupDate: '2/16',
        discountApplied: 'false',
        // no original_amount_cents
      },
    })
    fetchSpy.mockResolvedValue({ ok: true, json: async () => session })

    const wrapper = mountSuccess()
    await new Promise(r => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    // The component's originalAmount computed should fall back to amount_total
    expect((wrapper.vm as { originalAmount: number }).originalAmount).toBe(2500)
  })
})

describe('SuccessView — error state', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows an error when the session fetch returns a non-ok response', async () => {
    fetchSpy.mockResolvedValue({ ok: false })

    const wrapper = mountSuccess()
    await new Promise(r => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.loading').exists()).toBe(false)
    expect(wrapper.find('.error-message').exists()).toBe(true)
    expect(wrapper.find('.error-message').text()).toContain('Unable to load')
  })

  it('shows an error when fetch throws', async () => {
    fetchSpy.mockRejectedValue(new Error('Network failure'))

    const wrapper = mountSuccess()
    await new Promise(r => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.error-message').exists()).toBe(true)
  })

  it('shows "No order information available" when session_id is missing from URL', async () => {
    // Override location to have no session_id
    Object.defineProperty(window, 'location', {
      value: { search: '' },
      writable: true,
      configurable: true,
    })

    const wrapper = mount(SuccessView, {
      global: { plugins: [router] },
    })
    await new Promise(r => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(wrapper.find('.error-message').text()).toContain('No order information')
  })
})
