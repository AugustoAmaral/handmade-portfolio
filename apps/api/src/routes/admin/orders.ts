import { MAX_TRACKING_CODE, ORDER_STATUSES, canTransition, type OrderStatus } from '@shop/shared'
import { Router } from 'express'
import { z } from 'zod'
import { AppError } from '../../errors.js'
import { adminGuard } from '../../middleware/auth.js'
import { Order, toAdminOrder } from '../../models/order.js'

// `as const` keeps the spread a readonly tuple, which is what z.enum accepts.
const listQuerySchema = z.object({ status: z.enum([...ORDER_STATUSES, 'all'] as const).optional() })
const patchSchema = z.object({
  status: z.literal('shipped'),
  trackingCode: z.string().trim().min(1).max(MAX_TRACKING_CODE).optional(),
})

export const adminOrdersRouter = Router()
adminOrdersRouter.use('/api/admin/orders', adminGuard)

adminOrdersRouter.get('/api/admin/orders', async (req, res) => {
  const { status } = listQuerySchema.parse(req.query)
  const filter = status === 'all' ? {} : status ? { status } : { status: { $ne: 'expired' } }
  const orders = await Order.find(filter).sort({ createdAt: -1 })
  res.json({ orders: orders.map(toAdminOrder) })
})

adminOrdersRouter.patch('/api/admin/orders/:id', async (req, res) => {
  const patch = patchSchema.parse(req.body)
  const order = await Order.findById(req.params.id).catch(() => null)
  if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found')
  if (!canTransition(order.status as OrderStatus, patch.status))
    throw new AppError(409, 'INVALID_TRANSITION', `Cannot move an order from ${order.status} to ${patch.status}`)
  order.status = patch.status
  order.shippedAt = new Date()
  if (patch.trackingCode) order.trackingCode = patch.trackingCode
  await order.save()
  res.json({ order: toAdminOrder(order) })
})
