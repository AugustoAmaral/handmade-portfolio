import express, { Router } from 'express'
import type Stripe from 'stripe'
import { getEnv } from '../env.js'
import { stripe } from '../lib/stripe.js'
import { Order } from '../models/order.js'
import { Product } from '../models/product.js'

export const webhookRouter = Router()

webhookRouter.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'] as string,
      getEnv().STRIPE_WEBHOOK_SECRET,
    )
  } catch {
    res.status(400).json({ error: { code: 'INVALID_SIGNATURE', message: 'Invalid Stripe signature' } })
    return
  }

  if (event.type === 'checkout.session.completed') {
    await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
  } else if (event.type === 'checkout.session.expired') {
    await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session)
  }
  res.json({ received: true })
})

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // Card only (see checkout-session.ts), but async methods can be flipped on in the Stripe
  // dashboard without a deploy and fire this event with payment_status 'unpaid'.
  if (session.payment_status !== 'paid') return

  const update: Record<string, unknown> = { status: 'paid', paidAt: new Date() }
  if (typeof session.payment_intent === 'string') update.stripePaymentIntentId = session.payment_intent
  if (session.amount_total != null) update['amounts.totalCents'] = session.amount_total
  if (session.currency) update['amounts.currency'] = session.currency

  // The idempotency gate: only a pending order flips to paid, and only once. A duplicate
  // delivery (Stripe retries aggressively) finds nothing to update and stops here.
  const before = await Order.findOneAndUpdate(
    { stripeSessionId: session.id, status: 'pending' },
    { $set: update },
    { new: false },
  )
  if (!before) return

  if (session.amount_total != null && session.amount_total !== before.amounts!.totalCents) {
    console.error('[webhook] RECONCILE: Stripe charged a different total than the order snapshot', {
      orderNumber: before.orderNumber,
      snapshotCents: before.amounts!.totalCents,
      chargedCents: session.amount_total,
    })
  }

  const products = await Product.find({ _id: { $in: before.items.map((i) => i.productId) } })
  const byId = new Map(products.map((p) => [String(p._id), p]))

  for (const item of before.items) {
    const product = byId.get(item.productId)
    if (!product || product.stock === null) continue // made to order: nothing to decrement
    try {
      const decremented = await Product.findOneAndUpdate(
        { _id: item.productId, stock: { $gte: item.qty } },
        { $inc: { stock: -item.qty } },
      )
      if (!decremented) {
        // Guard on status: if the admin already shipped this order in the meantime, don't
        // clobber that transition back to oversold.
        await Order.updateOne({ _id: before._id, status: 'paid' }, { $set: { status: 'oversold' } })
      }
    } catch (err) {
      // The order is already paid at this point, so a 500 would only make Stripe retry into
      // the no-op above. Known v1 gap kept: no transactions on Atlas M0, so a crash between the
      // status flip and this loop leaves a paid order with stock never adjusted. Log loudly.
      console.error('[webhook] RECONCILE: stock decrement failed after order was paid', {
        orderNumber: before.orderNumber,
        productId: item.productId,
        err,
      })
    }
  }
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  await Order.updateOne({ stripeSessionId: session.id, status: 'pending' }, { $set: { status: 'expired' } })
}
