import type { Buyer, ShippingAddress, ShippingMethodInfo } from '@shop/shared'
import type Stripe from 'stripe'

export interface SessionLine {
  name: string
  unitAmountCents: number
  qty: number
}

export interface SessionInput {
  orderId: string
  orderNumber: number
  locale: 'pt' | 'en'
  buyer: Buyer
  lines: SessionLine[]
  shipping: null | { method: ShippingMethodInfo; address: ShippingAddress }
  webOrigin: string
}

const SHIPPING_LABEL = { pt: 'Frete', en: 'Shipping' } as const

export function toStripeAddress(a: ShippingAddress): Stripe.ShippingAddressParam {
  const line2 = [a.complement, a.district].filter(Boolean).join(' - ')
  return {
    country: a.country,
    postal_code: a.postalCode,
    line1: a.number ? `${a.street}, ${a.number}` : a.street,
    line2: line2 || undefined,
    city: a.city,
    state: a.state,
  }
}

// Pure: everything Stripe needs, nothing read from the outside. Prices arrive already looked up
// from Mongo by the caller. Stripe requires shipping_address_collection to use shipping_options,
// and the address is ours now, so shipping is an ordinary line item and the address travels on
// the PaymentIntent (shows on the receipt and in the dashboard).
export function buildCheckoutSessionParams(input: SessionInput): Stripe.Checkout.SessionCreateParams {
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = input.lines.map((l) => ({
    quantity: l.qty,
    price_data: { currency: 'brl', unit_amount: l.unitAmountCents, product_data: { name: l.name } },
  }))

  if (input.shipping) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: 'brl',
        unit_amount: input.shipping.method.cents,
        product_data: { name: `${SHIPPING_LABEL[input.locale]} · ${input.shipping.method.name[input.locale]}` },
      },
    })
  }

  const result: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    payment_method_types: ['card'],
    locale: input.locale,
    customer_email: input.buyer.email,
    client_reference_id: input.orderId,
    metadata: { orderId: input.orderId, orderNumber: String(input.orderNumber) },
    line_items: lineItems,
    success_url: `${input.webOrigin}/thanks?order=${input.orderNumber}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.webOrigin}/checkout`,
  }

  if (input.shipping) {
    result.payment_intent_data = {
      shipping: {
        name: input.buyer.name,
        phone: input.buyer.phone,
        address: toStripeAddress(input.shipping.address),
      },
    }
  }

  return result
}
