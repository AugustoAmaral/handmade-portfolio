import {
  SHIPPING_METHODS,
  checkoutRequestSchema,
  checkoutRules,
  computeTotals,
  hasPhysicalItems,
} from '@shop/shared'
import { Router } from 'express'
import { getEnv } from '../env.js'
import { AppError } from '../errors.js'
import { buildCheckoutSessionParams } from '../lib/checkout-session.js'
import { stripe } from '../lib/stripe.js'
import { nextOrderNumber } from '../models/counter.js'
import { Order } from '../models/order.js'
import { Product } from '../models/product.js'

export const checkoutRouter = Router()

checkoutRouter.post('/api/checkout', async (req, res) => {
  const body = checkoutRequestSchema.parse(req.body)
  const env = getEnv()

  // Prices and stock come from Mongo. The client only tells us slugs and quantities.
  const products = await Product.find({ slug: { $in: body.items.map((i) => i.slug) }, active: true })
  const bySlug = new Map(products.map((p) => [p.slug, p]))
  const lines = body.items.map((item) => {
    const product = bySlug.get(item.slug)
    if (!product) throw new AppError(400, 'UNKNOWN_ITEM', `Unknown item: ${item.slug}`)
    if (product.stock != null && item.qty > product.stock)
      throw new AppError(400, 'OUT_OF_STOCK', `Not enough stock for: ${item.slug}`)
    return { product, qty: item.qty }
  })

  const physical = hasPhysicalItems(lines.map((l) => ({ type: l.product.type })))
  const ruleErrors = checkoutRules(body, physical)
  if (ruleErrors) throw new AppError(400, 'VALIDATION', 'Invalid checkout details', ruleErrors)

  const method = physical ? body.shippingMethod! : null
  const address = physical ? body.shippingAddress! : null
  const totals = computeTotals(
    lines.map((l) => ({ priceCents: l.product.priceCents, qty: l.qty, type: l.product.type })),
    method,
  )

  const orderNumber = await nextOrderNumber()
  const order = await Order.create({
    orderNumber,
    status: 'pending',
    buyer: body.buyer,
    shippingAddress: address,
    shippingMethod: method,
    notes: body.notes,
    giftMessage: body.giftMessage,
    referral: body.referral,
    locale: body.locale,
    items: lines.map((l) => ({
      productId: String(l.product._id),
      slug: l.product.slug,
      name: { pt: l.product.name!.pt!, en: l.product.name!.en! },
      qty: l.qty,
      unitAmountCents: l.product.priceCents,
    })),
    amounts: { ...totals, currency: 'brl' },
  })

  let session
  try {
    session = await stripe.checkout.sessions.create(
      buildCheckoutSessionParams({
        orderId: String(order._id),
        orderNumber,
        locale: body.locale,
        buyer: body.buyer,
        lines: lines.map((l) => ({ name: l.product.name![body.locale]!, unitAmountCents: l.product.priceCents, qty: l.qty })),
        shipping: method && address ? { method: SHIPPING_METHODS[method], address } : null,
        webOrigin: env.WEB_ORIGIN,
      }),
    )
  } catch (err) {
    // No session means the buyer can never pay this order; drop it rather than leave a ghost.
    await Order.deleteOne({ _id: order._id })
    console.error('[checkout] stripe session creation failed', { orderNumber, err })
    throw new AppError(502, 'STRIPE_UNAVAILABLE', 'Payment provider unavailable, please try again')
  }

  order.stripeSessionId = session.id
  await order.save()
  res.json({ url: session.url, orderNumber })
})
