import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const orderSchema = new Schema(
  {
    stripeSessionId: { type: String, required: true, unique: true },
    stripePaymentIntentId: { type: String },
    items: [
      {
        productId: String,
        slug: String,
        name: { pt: String, en: String },
        qty: Number,
        unitAmountCents: Number,
      },
    ],
    amounts: {
      itemsCents: { type: Number, required: true },
      shippingCents: { type: Number, required: true },
      totalCents: { type: Number, required: true },
      currency: { type: String, required: true },
    },
    customer: { email: String, name: String },
    shippingAddress: { type: Schema.Types.Mixed, default: null },
    status: { type: String, enum: ['paid', 'fulfilled', 'oversold'], default: 'paid' },
    trackingCode: { type: String },
  },
  { timestamps: true },
)

export type OrderDoc = mongoose.HydratedDocument<InferSchemaType<typeof orderSchema>>
export const Order = mongoose.model('Order', orderSchema)
