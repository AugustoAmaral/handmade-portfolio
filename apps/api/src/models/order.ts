import {
  ORDER_STATUSES,
  SHIPPING_METHODS,
  type AdminOrder,
  type OrderStatus,
  type PublicOrder,
  type ShippingAddress,
  type ShippingMethod,
} from '@shop/shared'
import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const localized = { pt: { type: String, required: true }, en: { type: String, required: true } }

const shippingAddressSchema = new Schema(
  {
    country: { type: String, required: true },
    postalCode: { type: String, required: true },
    street: { type: String, required: true },
    number: String,
    complement: String,
    district: String,
    city: { type: String, required: true },
    state: String,
  },
  { _id: false },
)

const orderItemSchema = new Schema(
  {
    productId: { type: String, required: true },
    slug: { type: String, required: true },
    name: localized,
    qty: { type: Number, required: true },
    unitAmountCents: { type: Number, required: true },
  },
  { _id: false },
)

const orderSchema = new Schema(
  {
    // Sparse so that unmigrated v1 documents (no orderNumber) do not break the index build at
    // boot; v2 documents always carry it because the schema requires it.
    orderNumber: { type: Number, required: true, unique: true, sparse: true },
    status: { type: String, enum: ORDER_STATUSES, required: true, default: 'pending' },
    // Set right after the Stripe session is created; pending orders briefly have none, hence sparse.
    stripeSessionId: { type: String, unique: true, sparse: true },
    stripePaymentIntentId: String,
    buyer: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: String,
    },
    shippingAddress: { type: shippingAddressSchema, default: null },
    // 'pac' | 'sedex' | 'intl' | null — validated by zod at the API boundary.
    shippingMethod: { type: String, default: null },
    notes: String,
    giftMessage: String,
    referral: String,
    locale: { type: String, enum: ['pt', 'en'], required: true },
    items: { type: [orderItemSchema], default: [] },
    amounts: {
      itemsCents: { type: Number, required: true },
      shippingCents: { type: Number, required: true },
      totalCents: { type: Number, required: true },
      currency: { type: String, required: true },
    },
    trackingCode: String,
    paidAt: Date,
    shippedAt: Date,
  },
  { timestamps: true },
)

export type OrderDoc = mongoose.HydratedDocument<InferSchemaType<typeof orderSchema>>
export const Order = mongoose.model('Order', orderSchema)

function addressOf(doc: OrderDoc): ShippingAddress | null {
  const a = doc.shippingAddress
  if (!a) return null
  return {
    country: a.country,
    postalCode: a.postalCode,
    street: a.street,
    number: a.number ?? undefined,
    complement: a.complement ?? undefined,
    district: a.district ?? undefined,
    city: a.city,
    state: a.state ?? undefined,
  }
}

function methodOf(doc: OrderDoc): ShippingMethod | null {
  return (doc.shippingMethod as ShippingMethod | null | undefined) ?? null
}

export function toPublicOrder(doc: OrderDoc): PublicOrder {
  const method = methodOf(doc)
  return {
    orderNumber: doc.orderNumber,
    status: doc.status as OrderStatus,
    items: doc.items.map((i) => ({ name: { pt: i.name!.pt!, en: i.name!.en! }, qty: i.qty })),
    totalCents: doc.amounts!.totalCents,
    currency: doc.amounts!.currency,
    shippingMethod: method,
    eta: method ? (SHIPPING_METHODS[method]?.eta ?? null) : null,
  }
}

export function toAdminOrder(doc: OrderDoc): AdminOrder {
  return {
    id: String(doc._id),
    orderNumber: doc.orderNumber,
    status: doc.status as OrderStatus,
    createdAt: doc.createdAt!.toISOString(),
    paidAt: doc.paidAt?.toISOString(),
    shippedAt: doc.shippedAt?.toISOString(),
    buyer: { name: doc.buyer!.name!, email: doc.buyer!.email!, phone: doc.buyer!.phone ?? undefined },
    shippingAddress: addressOf(doc),
    shippingMethod: methodOf(doc),
    notes: doc.notes ?? undefined,
    giftMessage: doc.giftMessage ?? undefined,
    referral: doc.referral ?? undefined,
    locale: doc.locale as 'pt' | 'en',
    items: doc.items.map((i) => ({
      productId: i.productId,
      slug: i.slug,
      name: { pt: i.name!.pt!, en: i.name!.en! },
      qty: i.qty,
      unitAmountCents: i.unitAmountCents,
    })),
    amounts: {
      itemsCents: doc.amounts!.itemsCents,
      shippingCents: doc.amounts!.shippingCents,
      totalCents: doc.amounts!.totalCents,
      currency: doc.amounts!.currency,
    },
    trackingCode: doc.trackingCode ?? undefined,
    stripeSessionId: doc.stripeSessionId ?? undefined,
    stripePaymentIntentId: doc.stripePaymentIntentId ?? undefined,
  }
}
