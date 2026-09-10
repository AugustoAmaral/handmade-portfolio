import mongoose from 'mongoose'
import { nextOrderNumber } from '../models/counter.js'
import { Order } from '../models/order.js'

type Raw = Record<string, unknown>

interface V1StripeAddress {
  name?: string
  address?: { line1?: string; line2?: string; city?: string; state?: string; postal_code?: string; country?: string }
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

// Pure mapping from a v1 order document to the $set/$unset that turn it into a v2 document.
// v1 stored the address exactly as Stripe returned it and had no shipping method; the method is
// inferred from the country (BR → pac, anything else → intl) because v1 only had two flat rates.
export function migrateOrderDoc(raw: Raw, orderNumber: number): { $set: Raw; $unset: Record<string, ''> } {
  const customer = (raw.customer ?? {}) as { email?: string; name?: string }
  const v1Address = raw.shippingAddress as V1StripeAddress | null | undefined
  const a = v1Address?.address
  const shippingAddress = a
    ? {
        country: a.country ?? 'BR',
        postalCode: a.postal_code ?? '',
        street: a.line1 ?? '',
        ...(str(a.line2) && { complement: a.line2 }),
        city: a.city ?? '',
        ...(str(a.state) && { state: a.state }),
      }
    : null
  const v1Status = raw.status as string
  const status = v1Status === 'fulfilled' ? 'shipped' : v1Status
  const createdAt = raw.createdAt as Date | undefined
  const updatedAt = raw.updatedAt as Date | undefined

  const $set: Raw = {
    orderNumber,
    status,
    buyer: { name: str(customer.name) ?? 'Unknown', email: str(customer.email) ?? 'unknown@example.com' },
    shippingAddress,
    shippingMethod: shippingAddress ? (shippingAddress.country === 'BR' ? 'pac' : 'intl') : null,
    locale: 'en',
    ...(createdAt && { paidAt: createdAt }),
    ...(status === 'shipped' && updatedAt && { shippedAt: updatedAt }),
  }
  return { $set, $unset: { customer: '' } }
}

// Idempotent: only documents without an orderNumber are touched. Oldest first so numbers follow
// purchase order. Uses the raw collection because the v1 shape does not validate against the
// v2 schema.
export async function runMigration(): Promise<number> {
  const col = mongoose.connection.collection('orders')
  const legacy = await col.find({ orderNumber: { $exists: false } }).sort({ createdAt: 1 }).toArray()
  for (const raw of legacy) {
    const orderNumber = await nextOrderNumber()
    const { $set, $unset } = migrateOrderDoc(raw as Raw, orderNumber)
    await col.updateOne({ _id: raw._id }, { $set, $unset })
  }
  await Order.syncIndexes()
  return legacy.length
}
