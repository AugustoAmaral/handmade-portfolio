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
  }
  res.json({ received: true })
})

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // v1 only accepts card payments (see checkout.ts), which settle synchronously, but async
  // payment methods (e.g. Pix) can be flipped on via the Stripe dashboard without a deploy.
  // Those fire this same event with payment_status 'unpaid' — treating that as paid would
  // create a paid order and permanently decrement stock for money that never arrives.
  if (session.payment_status !== 'paid') return

  const meta: { i: string; s: string; q: number; u: number }[] = JSON.parse(session.metadata?.items ?? '[]')
  const products = await Product.find({ _id: { $in: meta.map((m) => m.i) } })
  const byId = new Map(products.map((p) => [String(p._id), p]))

  // Some Stripe API versions expose shipping under collected_information.
  const sessionAny = session as unknown as Record<string, unknown>
  const collected = sessionAny.collected_information as { shipping_details?: unknown } | undefined
  const shippingAddress = collected?.shipping_details ?? sessionAny.shipping_details ?? null

  let order
  try {
    // Order.create is the idempotency gate: the unique index on stripeSessionId
    // makes sure stock is decremented exactly once per session.
    order = await Order.create({
      stripeSessionId: session.id,
      stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
      items: meta.map((m) => {
        const p = byId.get(m.i)
        return {
          productId: m.i,
          slug: m.s,
          name: p ? { pt: p.name!.pt, en: p.name!.en } : { pt: m.s, en: m.s },
          qty: m.q,
          unitAmountCents: m.u,
        }
      }),
      amounts: {
        itemsCents: session.amount_subtotal ?? 0,
        shippingCents: session.total_details?.amount_shipping ?? 0,
        totalCents: session.amount_total ?? 0,
        currency: session.currency ?? 'brl',
      },
      customer: { email: session.customer_details?.email, name: session.customer_details?.name },
      shippingAddress,
      status: 'paid',
    })
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return // duplicate event
    throw err
  }

  for (const m of meta) {
    const p = byId.get(m.i)
    if (!p || p.stock === null) continue
    try {
      const decremented = await Product.findOneAndUpdate(
        { _id: m.i, stock: { $gte: m.q } },
        { $inc: { stock: -m.q } },
      )
      if (!decremented) {
        order.status = 'oversold'
        await order.save()
      }
    } catch (err) {
      // The order already exists at this point, so a 500 here would only make Stripe retry
      // into the E11000 idempotency no-op above — the retry can never re-attempt this
      // decrement. Log loudly for manual reconciliation instead of rethrowing.
      //
      // Known accepted gap for v1: a crash between Order.create above and this decrement loop
      // is unrecoverable via Stripe retries (the E11000 branch just no-ops) — the order stays
      // 'paid' with stock never adjusted. We don't run Mongo transactions here (Atlas M0 is a
      // single node without a replica set), so there's no atomic way to tie the two together.
      // Reconcile manually from this RECONCILE log line / the admin order list if it happens.
      console.error('[webhook] RECONCILE: stock decrement failed after order create', {
        sessionId: session.id,
        productId: m.i,
        err,
      })
    }
  }
}
