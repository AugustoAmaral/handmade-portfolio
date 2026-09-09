import type { CheckoutRequest, FieldErrors, TotalsLine } from '@shop/shared'
import { drawing, letter } from './products'

const buyer: CheckoutRequest['buyer'] = {
  name: 'Marina Bicalho',
  email: 'marina@example.com',
  phone: '+55 31 98812-4407',
}

export const emptyCheckout: CheckoutRequest = {
  items: [{ slug: letter.slug, qty: 1 }],
  locale: 'pt',
  buyer: { name: '', email: '' },
}

export const brCheckout: CheckoutRequest = {
  items: [{ slug: letter.slug, qty: 1 }, { slug: drawing.slug, qty: 2 }],
  locale: 'pt',
  buyer,
  shippingAddress: {
    country: 'BR',
    postalCode: '30150-904',
    street: 'Rua Sapucaí',
    number: '388',
    complement: 'ap. 51',
    district: 'Floresta',
    city: 'Belo Horizonte',
    state: 'MG',
  },
  shippingMethod: 'sedex',
  notes: 'É presente, capricha no embrulho.',
}

export const intlCheckout: CheckoutRequest = {
  items: [{ slug: letter.slug, qty: 1 }],
  locale: 'en',
  buyer: { name: 'Sam Reyes', email: 'sam@example.com' },
  shippingAddress: {
    country: 'US',
    postalCode: '10001',
    street: '350 5th Ave',
    city: 'New York',
    state: 'NY',
  },
  shippingMethod: 'intl',
}

export const digitalCheckout: CheckoutRequest = {
  items: [{ slug: 'carta-digital', qty: 1 }],
  locale: 'pt',
  buyer,
}

/** What the checkout page shows after submitting an incomplete Brazilian address. */
export const brCheckoutErrors: FieldErrors = {
  'buyer.name': ['required'],
  'shippingAddress.postalCode': ['invalid_cep'],
  'shippingAddress.number': ['required'],
  shippingMethod: ['required'],
}

export const cartLines: TotalsLine[] = [
  { priceCents: letter.priceCents, qty: 1, type: 'physical' },
  { priceCents: drawing.priceCents, qty: 2, type: 'physical' },
]
