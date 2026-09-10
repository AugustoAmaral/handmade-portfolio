// E2e/dev boot: in-memory Mongo, seeded, fixed admin credentials. NEVER deployed.
import bcrypt from 'bcryptjs'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'

process.env.PORT ??= '3001'
// In CI an absent secret arrives as '' — treat empty as unset so ??= applies.
if (!process.env.STRIPE_SECRET_KEY) delete process.env.STRIPE_SECRET_KEY
process.env.STRIPE_SECRET_KEY ??= 'sk_test_dummy'
process.env.STRIPE_WEBHOOK_SECRET ??= 'whsec_dummy'
process.env.JWT_SECRET ??= 'e2e-secret'
process.env.ADMIN_EMAIL ??= 'admin@example.com'
process.env.ADMIN_PASSWORD_HASH ??= bcrypt.hashSync('admin123', 10)
process.env.WEB_ORIGIN ??= 'http://localhost:5173'
process.env.R2_ACCOUNT_ID ??= 'e2e'
process.env.R2_ACCESS_KEY_ID ??= 'e2e'
process.env.R2_SECRET_ACCESS_KEY ??= 'e2e'
process.env.R2_BUCKET ??= 'e2e'
process.env.R2_PUBLIC_URL ??= 'https://img.example.com'

const mongod = await MongoMemoryServer.create()
process.env.MONGO_URL = mongod.getUri()

const { createApp } = await import('./app.js')
const { seedProducts } = await import('./seed.js')
const { Product } = await import('./models/product.js')

await mongoose.connect(process.env.MONGO_URL)
await seedProducts()

// TWO PHOTOS ON THE ONE PIECE THE SHOP'S OWN E2E DOES NOT READ, written straight onto the
// document, because the seed cannot carry them and the upload cannot run here. `productInputSchema` strips `photos` — a photo exists only as the answer
// to a multipart POST — and that POST is the one admin path this boot has no way to serve:
// `putObject` builds its endpoint from `R2_ACCOUNT_ID`, so it would leave the machine for an
// object store that does not exist and the route would answer 500.
//
// WHAT THE PANEL'S SAVE NEEDS IS THE DOCUMENT AND NOT THE OBJECTS. Reordering and alt text ride on
// `PUT /api/admin/products/:id`, which decides its permutation rule entirely from `doc.photos` —
// so two rows here are enough for the e2e to run the real check against a real body. The `url`s
// they produce point at a host that does not resolve; the spec blocks the requests rather than
// letting each card wait one failed image out. `original-pencil-drawing` and not the featured
// letter: the letter is the home page's hero and the subject of every shop assertion in the spec,
// and giving it a photo would change the accessible name of the card those tests click.
//
// The two ALT texts are deliberately different sentences: the reorder assertion reads them to tell
// the cards apart, and two photos described the same way would make the swap invisible.
await Product.updateOne(
  { slug: 'original-pencil-drawing' },
  {
    $set: {
      photos: [
        { r2Key: 'products/seed/drawing-full.webp', alt: { pt: 'O desenho inteiro na folha', en: 'The whole drawing on the sheet' } },
        { r2Key: 'products/seed/drawing-corner.webp', alt: { pt: 'Detalhe do canto sombreado', en: 'Shaded corner detail' } },
      ],
    },
  },
)

// ONE INACTIVE DRAFT, WHICH THE SHOP CANNOT SEE. `GET /api/products` filters `{ active: true }`
// and `GET /api/admin/products` does not, and with four active seeds and nothing else the two
// endpoints answer with the same rows — so a panel that read the shop's list would look exactly
// right. This is the piece that makes that difference visible from a browser.
await Product.updateOne(
  { slug: 'unfinished-woodcut' },
  {
    $setOnInsert: {
      name: { pt: 'Exhibit 005 — Xilogravura inacabada', en: 'Exhibit 005 — Unfinished woodcut' },
      subtitle: { pt: 'Rascunho · não publicado', en: 'Draft · unpublished' },
      description: {
        pt: 'Um teste de entalhe que ainda não está pronto para a loja.',
        en: 'A carving test that is not ready for the shop yet.',
      },
      priceCents: 8000,
      type: 'physical',
      stock: 2,
      specs: [],
      featured: false,
      active: false,
    },
  },
  { upsert: true },
)

createApp().listen(Number(process.env.PORT), () => {
  console.log(`e2e api on :${process.env.PORT}`)
})
