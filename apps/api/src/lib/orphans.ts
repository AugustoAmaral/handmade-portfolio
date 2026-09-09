import { Order } from '../models/order.js'

// A checkout that died between creating the order and saving the Stripe session id leaves a
// pending order nothing can ever reconcile (webhooks match by session id, the admin has no
// transition from pending). Anything older than the threshold is safely dead: the real window
// between the two writes is milliseconds.
export async function expireOrphanPendingOrders(olderThan: Date): Promise<number> {
  const result = await Order.updateMany(
    { status: 'pending', stripeSessionId: { $exists: false }, createdAt: { $lt: olderThan } },
    { $set: { status: 'expired' } },
  )
  return result.modifiedCount
}
