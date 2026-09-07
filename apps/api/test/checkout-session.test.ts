import { SHIPPING_METHODS } from '@shop/shared'
import { describe, expect, it } from 'vitest'
import { buildCheckoutSessionParams, toStripeAddress } from '../src/lib/checkout-session'

const buyer = { name: 'Marina Bicalho', email: 'marina@example.com', phone: '+55 31 98812-4407' }
const address = {
  country: 'BR', postalCode: '30150-904', street: 'Rua Sapucaí', number: '388', complement: 'ap. 51',
  district: 'Floresta', city: 'Belo Horizonte', state: 'MG',
}
const base = {
  orderId: '65f0c0ffee0000000000abcd',
  orderNumber: 413,
  locale: 'pt' as const,
  buyer,
  lines: [{ name: 'Carta escrita à mão', unitAmountCents: 5000, qty: 2 }],
  webOrigin: 'https://shop.example.com',
}

describe('buildCheckoutSessionParams', () => {
  it('builds a card-only session with DB prices, buyer email, order metadata and our URLs', () => {
    const p = buildCheckoutSessionParams({ ...base, shipping: null })
    expect(p.mode).toBe('payment')
    expect(p.payment_method_types).toEqual(['card'])
    expect(p.locale).toBe('pt')
    expect(p.customer_email).toBe('marina@example.com')
    expect(p.client_reference_id).toBe(base.orderId)
    expect(p.metadata).toEqual({ orderId: base.orderId, orderNumber: '413' })
    expect(p.line_items).toEqual([
      { quantity: 2, price_data: { currency: 'brl', unit_amount: 5000, product_data: { name: 'Carta escrita à mão' } } },
    ])
    expect(p.success_url).toBe('https://shop.example.com/thanks?order=413&session_id={CHECKOUT_SESSION_ID}')
    expect(p.cancel_url).toBe('https://shop.example.com/checkout')
  })

  it('never asks Stripe to collect an address or offer shipping options', () => {
    const p = buildCheckoutSessionParams({ ...base, shipping: { method: SHIPPING_METHODS.sedex, address } })
    expect(p.shipping_address_collection).toBeUndefined()
    expect(p.shipping_options).toBeUndefined()
  })

  it('adds shipping as a line item and passes the collected address to the payment intent', () => {
    const p = buildCheckoutSessionParams({ ...base, shipping: { method: SHIPPING_METHODS.sedex, address } })
    expect(p.line_items).toHaveLength(2)
    expect(p.line_items![1]).toEqual({
      quantity: 1,
      price_data: { currency: 'brl', unit_amount: 4100, product_data: { name: 'Frete · Correios SEDEX' } },
    })
    expect(p.payment_intent_data).toEqual({
      shipping: {
        name: 'Marina Bicalho',
        phone: '+55 31 98812-4407',
        address: {
          country: 'BR', postal_code: '30150-904', line1: 'Rua Sapucaí, 388', line2: 'ap. 51 - Floresta',
          city: 'Belo Horizonte', state: 'MG',
        },
      },
    })
  })

  it('labels the shipping line in English for the en locale', () => {
    const p = buildCheckoutSessionParams({ ...base, locale: 'en', shipping: { method: SHIPPING_METHODS.intl, address: { ...address, country: 'US' } } })
    expect(p.line_items![1]!.price_data!.product_data!.name).toBe('Shipping · International (Correios)')
  })

  it('omits digital-only shipping entirely', () => {
    const p = buildCheckoutSessionParams({ ...base, shipping: null })
    expect(p.line_items).toHaveLength(1)
    expect(p.payment_intent_data).toBeUndefined()
  })
})

describe('toStripeAddress', () => {
  it('joins street and number, and complement and district, dropping empties', () => {
    expect(toStripeAddress({ country: 'US', postalCode: '10001', street: '350 5th Ave', city: 'New York', state: 'NY' })).toEqual({
      country: 'US', postal_code: '10001', line1: '350 5th Ave', line2: undefined, city: 'New York', state: 'NY',
    })
  })
})
