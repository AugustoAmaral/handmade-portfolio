import type { PublicProduct } from '@shop/shared'
import mongoose, { Schema, type InferSchemaType } from 'mongoose'
import { getEnv } from '../env.js'

const photoSchema = new Schema(
  {
    r2Key: { type: String, required: true },
    alt: { pt: { type: String, default: '' }, en: { type: String, default: '' } },
  },
  { _id: false },
)

const specSchema = new Schema(
  {
    key: { pt: { type: String, required: true }, en: { type: String, required: true } },
    value: { pt: { type: String, required: true }, en: { type: String, required: true } },
  },
  { _id: false },
)

const productSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { pt: { type: String, required: true }, en: { type: String, required: true } },
    description: { pt: { type: String, required: true }, en: { type: String, required: true } },
    subtitle: { pt: { type: String, default: '' }, en: { type: String, default: '' } },
    priceCents: { type: Number, required: true },
    type: { type: String, enum: ['physical', 'digital'], required: true },
    stock: { type: Number, default: null },
    specs: { type: [specSchema], default: [] },
    photos: { type: [photoSchema], default: [] },
    featured: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export type ProductDoc = mongoose.HydratedDocument<InferSchemaType<typeof productSchema>>
export const Product = mongoose.model('Product', productSchema)

export function toPublicProduct(doc: ProductDoc): PublicProduct {
  const base = getEnv().R2_PUBLIC_URL
  return {
    id: String(doc._id),
    slug: doc.slug,
    name: { pt: doc.name!.pt!, en: doc.name!.en! },
    description: { pt: doc.description!.pt!, en: doc.description!.en! },
    subtitle: { pt: doc.subtitle?.pt ?? '', en: doc.subtitle?.en ?? '' },
    priceCents: doc.priceCents,
    type: doc.type,
    stock: doc.stock ?? null,
    specs: (doc.specs ?? []).map((s) => ({
      key: { pt: s.key!.pt!, en: s.key!.en! },
      value: { pt: s.value!.pt!, en: s.value!.en! },
    })),
    photos: (doc.photos ?? []).map((p) => ({
      key: p.r2Key,
      url: `${base}/${p.r2Key}`,
      alt: { pt: p.alt?.pt ?? '', en: p.alt?.en ?? '' },
    })),
    featured: doc.featured ?? false,
    active: doc.active,
  }
}
