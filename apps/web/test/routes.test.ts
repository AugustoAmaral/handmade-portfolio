import { describe, expect, it } from 'vitest'
import { routes } from '../src/ui/routes'

describe('routes', () => {
  it('builds the shop paths', () => {
    expect(routes.home()).toBe('/')
    expect(routes.about()).toBe('/about')
    expect(routes.checkout()).toBe('/checkout')
    expect(routes.product('carta-escrita')).toBe('/exhibit/carta-escrita')
  })

  it('encodes slugs and ids that need it', () => {
    expect(routes.product('a b/c')).toBe('/exhibit/a%20b%2Fc')
    expect(routes.adminProduct('id/1')).toBe('/admin/products/id%2F1')
  })

  it('builds the thank-you url with order and session', () => {
    expect(routes.thanks(413, 'cs_test_1')).toBe('/thanks?order=413&session_id=cs_test_1')
    expect(routes.thanks(413, 'cs+test/1')).toBe('/thanks?order=413&session_id=cs%2Btest%2F1')
  })

  it('builds the admin paths, with an optional selected order', () => {
    expect(routes.adminProducts()).toBe('/admin/products')
    expect(routes.adminNewProduct()).toBe('/admin/products/new')
    expect(routes.adminOrders()).toBe('/admin/orders')
    expect(routes.adminOrders('abc')).toBe('/admin/orders?order=abc')
  })

  it('builds a mailto with an encoded subject and body', () => {
    expect(routes.mailto('a@b.com', 'Pedido #MHP-0413')).toBe('mailto:a@b.com?subject=Pedido%20%23MHP-0413')
    expect(routes.mailto('a@b.com', 'S', 'line one')).toBe('mailto:a@b.com?subject=S&body=line%20one')
  })
})
