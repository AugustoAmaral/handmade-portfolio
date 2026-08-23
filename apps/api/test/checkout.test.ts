import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SHIPPING_BR_CENTS, SHIPPING_INTL_CENTS } from '@shop/shared'
import { createApp } from '../src/app'
import { Product } from '../src/models/product'
import { stripe } from '../src/lib/stripe'

vi.mock('../src/lib/stripe', () => ({
  stripe: { checkout: { sessions: { create: vi.fn() } } },
}))
const sessionsCreate = vi.mocked(stripe.checkout.sessions.create)

let letterId: string
let drawingId: string

beforeEach(async () => {
  sessionsCreate.mockReset()
  sessionsCreate.mockResolvedValue({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' } as never)
  const letter = await Product.create({
    slug: 'letter', name: { pt: 'Carta', en: 'Letter' }, description: { pt: 'x', en: 'x' },
    priceCents: 5000, type: 'physical', stock: null, active: true,
  })
  const drawing = await Product.create({
    slug: 'drawing', name: { pt: 'Desenho', en: 'Drawing' }, description: { pt: 'x', en: 'x' },
    priceCents: 12000, type: 'physical', stock: 1, active: true,
  })
  await Product.create({
    slug: 'doodle', name: { pt: 'Rabisco', en: 'Doodle' }, description: { pt: 'x', en: 'x' },
    priceCents: 1500, type: 'digital', stock: null, active: true,
  })
  letterId = String(letter._id)
  drawingId = String(drawing._id)
})

const post = (body: object) => request(createApp()).post('/api/checkout').send(body)

describe('POST /api/checkout', () => {
  it('creates a session with prices from the database, not the client', async () => {
    const res = await post({ items: [{ slug: 'letter', qty: 2 }], destination: 'BR', locale: 'pt' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' })
    const params = sessionsCreate.mock.calls[0][0]!
    expect(params.line_items).toEqual([
      expect.objectContaining({
        quantity: 2,
        price_data: expect.objectContaining({ currency: 'brl', unit_amount: 5000 }),
      }),
    ])
    expect(params.payment_method_types).toEqual(['card'])
    expect(params.locale).toBe('pt')
    expect(JSON.parse(params.metadata!.items as string)).toEqual([
      { i: letterId, s: 'letter', q: 2, u: 5000 },
    ])
  })

  it('uses BR flat shipping and restricts countries to BR', async () => {
    await post({ items: [{ slug: 'letter', qty: 1 }], destination: 'BR', locale: 'en' })
    const params = sessionsCreate.mock.calls[0][0]!
    expect(params.shipping_address_collection).toEqual({ allowed_countries: ['BR'] })
    expect(params.shipping_options![0]!.shipping_rate_data!.fixed_amount!.amount).toBe(SHIPPING_BR_CENTS)
  })

  it('uses international flat shipping for INTL destination', async () => {
    await post({ items: [{ slug: 'letter', qty: 1 }], destination: 'INTL', locale: 'en' })
    const params = sessionsCreate.mock.calls[0][0]!
    expect(params.shipping_address_collection!.allowed_countries).not.toContain('BR')
    expect(params.shipping_options![0]!.shipping_rate_data!.fixed_amount!.amount).toBe(SHIPPING_INTL_CENTS)
  })

  it('collects no shipping for a digital-only cart', async () => {
    await post({ items: [{ slug: 'doodle', qty: 1 }], destination: 'BR', locale: 'en' })
    const params = sessionsCreate.mock.calls[0][0]!
    expect(params.shipping_address_collection).toBeUndefined()
    expect(params.shipping_options).toBeUndefined()
  })

  it('rejects an unknown or inactive item', async () => {
    const res = await post({ items: [{ slug: 'ghost', qty: 1 }], destination: 'BR', locale: 'en' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('UNKNOWN_ITEM')
  })

  it('rejects qty above remaining stock for one-of-one items', async () => {
    const res = await post({ items: [{ slug: 'drawing', qty: 2 }], destination: 'BR', locale: 'en' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('OUT_OF_STOCK')
    expect(drawingId).toBeTruthy()
  })

  it('rejects invalid payloads with fieldErrors', async () => {
    const res = await post({ items: [], destination: 'BR', locale: 'en' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION')
  })
})
