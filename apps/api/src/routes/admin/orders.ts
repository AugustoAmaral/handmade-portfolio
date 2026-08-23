import { Router } from 'express'
import { z } from 'zod'
import { AppError } from '../../errors.js'
import { adminGuard } from '../../middleware/auth.js'
import { Order } from '../../models/order.js'

const patchSchema = z.object({
  status: z.enum(['paid', 'fulfilled', 'oversold']).optional(),
  trackingCode: z.string().optional(),
})

export const adminOrdersRouter = Router()
adminOrdersRouter.use('/api/admin/orders', adminGuard)

adminOrdersRouter.get('/api/admin/orders', async (_req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 }).select('-__v')
  res.json({ orders: orders.map((o) => ({ ...o.toObject(), id: String(o._id) })) })
})

adminOrdersRouter.patch('/api/admin/orders/:id', async (req, res) => {
  const patch = patchSchema.parse(req.body)
  const order = await Order.findByIdAndUpdate(req.params.id, patch, { new: true }).catch(() => null)
  if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found')
  res.json({ order: { ...order.toObject(), id: String(order._id) } })
})
