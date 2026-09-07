import { Router } from 'express'
import { AppError } from '../errors.js'
import { Order } from '../models/order.js'

export const ordersRouter = Router()

ordersRouter.get('/api/orders/summary', async (req, res) => {
  const sessionId = String(req.query.session_id ?? '')
  const order = await Order.findOne({ stripeSessionId: sessionId })
  if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found')
  res.json({
    order: {
      status: order.status,
      totalCents: order.amounts!.totalCents,
      currency: order.amounts!.currency,
      items: order.items.map((i) => ({ name: { pt: i.name!.pt, en: i.name!.en }, qty: i.qty })),
    },
  })
})
