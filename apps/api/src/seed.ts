import type { ProductInput } from '@shop/shared'
import mongoose from 'mongoose'
import { getEnv } from './env.js'
import { Product } from './models/product.js'

export const SEED_PRODUCTS: ProductInput[] = [
  {
    slug: 'handwritten-letter',
    name: { pt: 'Exhibit 001 — Carta escrita à mão', en: 'Exhibit 001 — Handwritten letter' },
    description: {
      pt: 'Uma carta escrita à mão por mim, sobre o que você quiser (ou sobre nada). Enviada pelo correio, de verdade.',
      en: 'A letter handwritten by me, about whatever you want (or about nothing). Shipped by actual mail.',
    },
    priceCents: 5000,
    type: 'physical',
    stock: null,
    active: true,
  },
  {
    slug: 'original-pencil-drawing',
    name: { pt: 'Exhibit 002 — Desenho original a lápis', en: 'Exhibit 002 — Original pencil drawing' },
    description: {
      pt: 'Um desenho original, peça única. Quando vender, acabou.',
      en: 'An original drawing, one of one. When it sells, it is gone.',
    },
    priceCents: 12000,
    type: 'physical',
    stock: 1,
    active: true,
  },
  {
    slug: 'digital-letter',
    name: { pt: 'Exhibit 003 — Carta digital', en: 'Exhibit 003 — Digital letter' },
    description: {
      pt: 'A mesma carta à mão, escaneada e enviada por email. Sem frete, sem espera de correio.',
      en: 'The same handwritten letter, scanned and emailed to you. No shipping, no postal wait.',
    },
    priceCents: 2000,
    type: 'digital',
    stock: null,
    active: true,
  },
  {
    slug: 'digital-doodle',
    name: { pt: 'Exhibit 004 — Rabisco digital', en: 'Exhibit 004 — Digital doodle' },
    description: {
      pt: 'Um rabisco feito especialmente pra você, entregue por email.',
      en: 'A doodle made especially for you, delivered by email.',
    },
    priceCents: 1500,
    type: 'digital',
    stock: null,
    active: true,
  },
]

export async function seedProducts() {
  for (const p of SEED_PRODUCTS) {
    await Product.updateOne({ slug: p.slug }, { $setOnInsert: p }, { upsert: true })
  }
}

// Run directly: npm run seed -w @shop/api (requires MONGO_URL)
if (import.meta.url === `file://${process.argv[1]}`) {
  await mongoose.connect(getEnv().MONGO_URL)
  await seedProducts()
  console.log('seeded')
  await mongoose.disconnect()
}
