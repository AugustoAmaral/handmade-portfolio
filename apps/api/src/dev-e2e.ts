// E2e/dev boot: in-memory Mongo, seeded, fixed admin credentials. NEVER deployed.
import {
  type Buyer,
  type OrderStatus,
  type ShippingAddress,
  type ShippingMethod,
  computeTotals,
} from '@shop/shared'
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

// FOUR ORDERS, WRITTEN STRAIGHT ONTO THE COLLECTION FOR THE REASON THE PHOTOS ABOVE WERE: the
// ordinary way to make one is to pay for it. `POST /api/checkout` creates the order and then asks
// Stripe for a session; the key this boot defaults to is `sk_test_dummy`, Stripe answers 401, and
// the route DELETES the order it had just made before answering 502 — so short of exporting a real
// test key, nothing a browser can do here leaves an `Order` behind. Without one,
// `GET /api/orders/:orderNumber` had no e2e coverage at all, and `/thanks` and the whole of
// `/admin/orders` — the list, the three filter modes and the PATCH — were addresses the suite
// could not open.
//
// FOUR STATUSES AND NOT FIVE. `shipped` is the one the dispatch test MAKES, out of #MHP-1002, and
// that is also why these are `$set` where the draft above is `$setOnInsert`: `ADMIN_ORDER_TRANSITIONS`
// gives `shipped` no way out, so a boot is what puts the paid order back.
//
// NO TWO OF THEM SHARE A FIELD AN ASSERTION CAN NAME — not the number, the buyer, the money, the
// status, the shipping method or the day. `apps/web/src/fixtures/orders.ts` carries the same rule
// and `fixtures.test.ts` pins it, after a sweep found three fixtures at one total and two buyers
// under one name: enough for "it shows THIS order's total" to pass on three other orders. The
// phone is the one field deliberately present on a single order, so the contact block in the
// detail pane is drawn both with its optional row and without it.
//
// `timestamps: false`, WITHOUT WHICH ALL FOUR DATES ARE TODAY. Mongoose overwrites a `createdAt`
// given in `$set` with the moment of the write — measured against this schema, not assumed — and
// `createdAt` is what the orders list prints in every row. It would have collapsed, silently and on
// every boot, the one field this fixture spreads out most carefully.
//
// AND THE NUMBERS START AT 1001 SO THEY CANNOT MEET THE COUNTER. `nextOrderNumber` starts at 1 and
// `orderNumber` is a unique index, so a checkout that really reaches Stripe — the one test in the
// spec that needs a real key — would collide with a seeded `1` and answer 500 instead.
const { Order } = await import('./models/order.js')

const pieces = new Map((await Product.find()).map((p) => [p.slug, p]))

// The snapshot `routes/checkout.ts` takes, taken the same way: an order remembers the name and the
// price the catalogue had when it was placed. So the money below is the seed's rather than a second
// copy of it, and the totals are `computeTotals`' rather than four numbers typed out by hand.
function line(slug: string, qty: number) {
  const product = pieces.get(slug)!
  return {
    productId: String(product._id),
    slug,
    name: { pt: product.name!.pt!, en: product.name!.en! },
    qty,
    unitAmountCents: product.priceCents,
  }
}

function amountsFor(items: ReturnType<typeof line>[], method: ShippingMethod) {
  const lines = items.map((i) => ({ priceCents: i.unitAmountCents, qty: i.qty, type: pieces.get(i.slug)!.type }))
  return { ...computeTotals(lines, method), currency: 'brl' }
}

/** Everything `routes/checkout.ts` writes that is not derived: the amounts come from `amountsFor`. */
interface E2eOrder {
  orderNumber: number
  status: OrderStatus
  stripeSessionId: string
  buyer: Buyer
  shippingAddress: ShippingAddress
  shippingMethod: ShippingMethod
  items: ReturnType<typeof line>[]
  createdAt: Date
  paidAt?: Date
}

const E2E_ORDERS: E2eOrder[] = [
  {
    orderNumber: 1001,
    status: 'pending',
    stripeSessionId: 'cs_e2e_1001',
    buyer: { name: 'Marta Rezende', email: 'marta@example.com' },
    shippingAddress: { country: 'BR', postalCode: '30150-904', street: 'Rua Sapucaí', number: '388', complement: 'ap. 51', district: 'Floresta', city: 'Belo Horizonte', state: 'MG' },
    shippingMethod: 'pac',
    items: [line('handwritten-letter', 3)],
    createdAt: new Date('2026-09-01T13:00:00.000Z'),
  },
  {
    orderNumber: 1002,
    status: 'paid',
    stripeSessionId: 'cs_e2e_1002',
    buyer: { name: 'Otávio Lins', email: 'otavio@example.com', phone: '+55 11 98812-4407' },
    shippingAddress: { country: 'BR', postalCode: '01310-200', street: 'Avenida Paulista', number: '1578', district: 'Bela Vista', city: 'São Paulo', state: 'SP' },
    shippingMethod: 'sedex',
    items: [line('handwritten-letter', 2)],
    createdAt: new Date('2026-09-03T13:00:00.000Z'),
    paidAt: new Date('2026-09-04T13:00:00.000Z'),
  },
  {
    orderNumber: 1003,
    status: 'oversold',
    stripeSessionId: 'cs_e2e_1003',
    buyer: { name: 'Sofia Quintela', email: 'sofia@example.com' },
    shippingAddress: { country: 'BR', postalCode: '90010-190', street: 'Rua da Praia', number: '12', district: 'Centro Histórico', city: 'Porto Alegre', state: 'RS' },
    shippingMethod: 'pac',
    items: [line('original-pencil-drawing', 1)],
    createdAt: new Date('2026-09-05T13:00:00.000Z'),
    paidAt: new Date('2026-09-06T13:00:00.000Z'),
  },
  {
    // The only order carrying a digital line, and it still pays postage — `computeTotals` charges
    // the method as soon as ONE line is physical, and two of these three are.
    orderNumber: 1004,
    status: 'expired',
    stripeSessionId: 'cs_e2e_1004',
    buyer: { name: 'Décio Rabelo', email: 'decio@example.com' },
    shippingAddress: { country: 'BR', postalCode: '50030-170', street: 'Rua do Bom Jesus', number: '197', district: 'Recife Antigo', city: 'Recife', state: 'PE' },
    shippingMethod: 'sedex',
    items: [line('handwritten-letter', 1), line('original-pencil-drawing', 1), line('digital-letter', 2)],
    createdAt: new Date('2026-09-02T13:00:00.000Z'),
  },
]

for (const order of E2E_ORDERS) {
  await Order.updateOne(
    { orderNumber: order.orderNumber },
    { $set: { ...order, locale: 'pt', amounts: amountsFor(order.items, order.shippingMethod) } },
    { upsert: true, timestamps: false },
  )
}

createApp().listen(Number(process.env.PORT), () => {
  console.log(`e2e api on :${process.env.PORT}`)
})
