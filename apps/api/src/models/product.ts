import type { PublicProduct } from '@shop/shared'
import mongoose, { Schema, type InferSchemaType } from 'mongoose'
import { getEnv } from '../env.js'

const productSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { pt: { type: String, required: true }, en: { type: String, required: true } },
    description: { pt: { type: String, required: true }, en: { type: String, required: true } },
    priceCents: { type: Number, required: true },
    type: { type: String, enum: ['physical', 'digital'], required: true },
    stock: { type: Number, default: null },
    photos: [{ r2Key: { type: String, required: true } }],
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export type ProductDoc = mongoose.HydratedDocument<InferSchemaType<typeof productSchema>>
export const Product = mongoose.model('Product', productSchema)

export function toPublicProduct(doc: ProductDoc): PublicProduct {
  return {
    id: String(doc._id),
    slug: doc.slug,
    name: { pt: doc.name!.pt!, en: doc.name!.en! },
    description: { pt: doc.description!.pt!, en: doc.description!.en! },
    priceCents: doc.priceCents,
    type: doc.type,
    stock: doc.stock ?? null,
    photos: doc.photos.map((p) => ({ url: `${getEnv().R2_PUBLIC_URL}/${p.r2Key}` })),
    active: doc.active,
  }
}
