import { Router } from 'express'
import { AppError } from '../errors.js'
import { Order, toPublicOrder } from '../models/order.js'

export const ordersRouter = Router()

// The Stripe session id only ever reaches the buyer's browser (success_url), so it acts as the
// order's password: knowing an order number alone reveals nothing.
ordersRouter.get('/api/orders/:orderNumber', async (req, res) => {
  const orderNumber = Number(req.params.orderNumber)
  const sessionId = String(req.query.session_id ?? '')
  if (!Number.isInteger(orderNumber) || !sessionId) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found')
  const order = await Order.findOne({ orderNumber, stripeSessionId: sessionId })
  if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found')
  res.json({ order: toPublicOrder(order) })
})
