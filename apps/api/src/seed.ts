import type { ProductInput } from '@shop/shared'
import mongoose from 'mongoose'
import { getEnv } from './env.js'
import { Product } from './models/product.js'

export const SEED_PRODUCTS: ProductInput[] = [
  {
    slug: 'handwritten-letter',
    name: { pt: 'Exhibit 001 — Carta escrita à mão', en: 'Exhibit 001 — Handwritten letter' },
    subtitle: { pt: 'Papel algodão · 2 folhas', en: 'Cotton paper · 2 sheets' },
    description: {
      pt: 'Uma carta escrita à mão por mim, sobre o que você quiser (ou sobre nada). Enviada pelo correio, de verdade.',
      en: 'A letter handwritten by me, about whatever you want (or about nothing). Shipped by actual mail.',
    },
    priceCents: 5000,
    type: 'physical',
    stock: null,
    specs: [
      { key: { pt: 'Formato', en: 'Format' }, value: { pt: 'A5, 2 folhas', en: 'A5, 2 sheets' } },
      { key: { pt: 'Papel', en: 'Paper' }, value: { pt: 'Algodão 180g', en: '180gsm cotton' } },
      { key: { pt: 'Prazo', en: 'Lead time' }, value: { pt: '5 dias úteis', en: '5 business days' } },
    ],
    featured: true,
    active: true,
  },
  {
    slug: 'original-pencil-drawing',
    name: { pt: 'Exhibit 002 — Desenho original a lápis', en: 'Exhibit 002 — Original pencil drawing' },
    subtitle: { pt: 'A5 · original', en: 'A5 · original' },
    description: {
      pt: 'Um desenho original, peça única. Quando vender, acabou.',
      en: 'An original drawing, one of one. When it sells, it is gone.',
    },
    priceCents: 12000,
    type: 'physical',
    stock: 1,
    specs: [
      { key: { pt: 'Formato', en: 'Format' }, value: { pt: 'A5 (14,8 × 21 cm)', en: 'A5 (5.8 × 8.3 in)' } },
      { key: { pt: 'Peça', en: 'Edition' }, value: { pt: 'Original, única', en: 'One of one' } },
    ],
    active: true,
  },
  {
    slug: 'digital-letter',
    name: { pt: 'Exhibit 003 — Carta digital', en: 'Exhibit 003 — Digital letter' },
    subtitle: { pt: 'Escaneada · por e-mail', en: 'Scanned · by e-mail' },
    description: {
      pt: 'A mesma carta à mão, escaneada e enviada por email. Sem frete, sem espera de correio.',
      en: 'The same handwritten letter, scanned and emailed to you. No shipping, no postal wait.',
    },
    priceCents: 2000,
    type: 'digital',
    stock: null,
    specs: [{ key: { pt: 'Entrega', en: 'Delivery' }, value: { pt: 'PDF por e-mail', en: 'PDF by e-mail' } }],
    active: true,
  },
  {
    slug: 'digital-doodle',
    name: { pt: 'Exhibit 004 — Rabisco digital', en: 'Exhibit 004 — Digital doodle' },
    subtitle: { pt: 'Feito pra você · por e-mail', en: 'Made for you · by e-mail' },
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
