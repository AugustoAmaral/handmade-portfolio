import {
  INTL_ALLOWED_COUNTRIES,
  SHIPPING_BR_CENTS,
  SHIPPING_INTL_CENTS,
  checkoutRequestSchema,
} from '@shop/shared'
import { Router } from 'express'
import type Stripe from 'stripe'
import { getEnv } from '../env.js'
import { AppError } from '../errors.js'
import { stripe } from '../lib/stripe.js'
import { Product } from '../models/product.js'

export const checkoutRouter = Router()

checkoutRouter.post('/api/checkout', async (req, res) => {
  const { items, destination, locale } = checkoutRequestSchema.parse(req.body)
  const env = getEnv()

  const products = await Product.find({ slug: { $in: items.map((i) => i.slug) }, active: true })
  const bySlug = new Map(products.map((p) => [p.slug, p]))

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
  const metadataItems: { i: string; s: string; q: number; u: number }[] = []
  let hasPhysical = false

  for (const item of items) {
    const product = bySlug.get(item.slug)
    if (!product) throw new AppError(400, 'UNKNOWN_ITEM', `Unknown item: ${item.slug}`)
    if (product.stock != null && item.qty > product.stock)
      throw new AppError(400, 'OUT_OF_STOCK', `Not enough stock for: ${item.slug}`)
    if (product.type === 'physical') hasPhysical = true
    lineItems.push({
      quantity: item.qty,
      price_data: {
        currency: 'brl',
        unit_amount: product.priceCents,
        product_data: { name: product.name![locale]! },
      },
    })
    metadataItems.push({ i: String(product._id), s: product.slug, q: item.qty, u: product.priceCents })
  }

  const shippingCents = destination === 'BR' ? SHIPPING_BR_CENTS : SHIPPING_INTL_CENTS
  const allowedCountries = (destination === 'BR' ? ['BR'] : INTL_ALLOWED_COUNTRIES) as
    Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[]

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: lineItems,
    locale,
    ...(hasPhysical && {
      shipping_address_collection: { allowed_countries: allowedCountries },
      shipping_options: [
        {
          shipping_rate_data: {
            display_name: destination === 'BR' ? 'Brazil (flat rate)' : 'International (flat rate)',
            type: 'fixed_amount',
            fixed_amount: { amount: shippingCents, currency: 'brl' },
          },
        },
      ],
    }),
    metadata: { items: JSON.stringify(metadataItems), destination },
    success_url: `${env.WEB_ORIGIN}/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.WEB_ORIGIN}/cart`,
  })

  res.json({ url: session.url })
})
