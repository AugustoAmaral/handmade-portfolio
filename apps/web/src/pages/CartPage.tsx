import type { PublicProduct } from '@shop/shared'
import { SHIPPING_BR_CENTS, SHIPPING_INTL_CENTS, formatPrice } from '@shop/shared'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button, Card } from '../components/ui'
import { ApiError, api } from '../lib/api'
import { useCart } from '../lib/cart'
import { useLang } from '../i18n'

export function CartPage() {
  const { t } = useTranslation()
  const lang = useLang()
  const cart = useCart()
  const [destination, setDestination] = useState<'BR' | 'INTL'>('BR')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data } = useQuery({
    queryKey: ['products'],
    queryFn: () => api<{ products: PublicProduct[] }>('/api/products'),
  })
  const bySlug = new Map((data?.products ?? []).map((p) => [p.slug, p]))
  const lines = cart.items
    .map((i) => ({ ...i, product: bySlug.get(i.slug) }))
    .filter((l): l is typeof l & { product: PublicProduct } => Boolean(l.product))

  if (cart.items.length === 0)
    return (
      <div className="space-y-2">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <p className="text-stone-600">
          {t('cart.empty')} <Link to="/" className="underline">{t('cart.backToShop')}</Link>
        </p>
      </div>
    )

  const hasPhysical = lines.some((l) => l.product.type === 'physical')
  const itemsCents = lines.reduce((sum, l) => sum + l.product.priceCents * l.qty, 0)
  const shippingCents = hasPhysical ? (destination === 'BR' ? SHIPPING_BR_CENTS : SHIPPING_INTL_CENTS) : 0

  async function checkout() {
    setSubmitting(true)
    setError(null)
    try {
      const { url } = await api<{ url: string }>('/api/checkout', {
        method: 'POST',
        body: JSON.stringify({
          items: lines.map((l) => ({ slug: l.slug, qty: l.qty })),
          destination,
          locale: lang,
        }),
      })
      window.location.assign(url)
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'OUT_OF_STOCK' || err.code === 'UNKNOWN_ITEM')) {
        const slug = err.message.replace(/^.*: /, '')
        const name = bySlug.get(slug)?.name[lang] ?? slug
        cart.remove(slug)
        setError(
          t(err.code === 'OUT_OF_STOCK' ? 'cart.checkoutErrorOutOfStock' : 'cart.checkoutErrorUnknownItem', { name }),
        )
      } else {
        setError(t('cart.checkoutError'))
      }
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {lines.map((l) => (
        <Card key={l.slug} className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">{l.product.name[lang]}</p>
            <p className="text-sm text-stone-600">{formatPrice(l.product.priceCents, lang)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" aria-label={t('cart.decrease')} onClick={() => cart.setQty(l.slug, l.qty - 1)}>−</Button>
            <span className="w-6 text-center">{l.qty}</span>
            <Button variant="outline" aria-label={t('cart.increase')} onClick={() => cart.setQty(l.slug, l.qty + 1)}>+</Button>
          </div>
        </Card>
      ))}

      {hasPhysical && (
        <Card>
          <p className="mb-2 text-sm font-medium">{t('cart.shipTo')}</p>
          {(['BR', 'INTL'] as const).map((d) => (
            <label key={d} className="mr-6 inline-flex items-center gap-2 text-sm">
              <input type="radio" name="destination" checked={destination === d} onChange={() => setDestination(d)} />
              {d === 'BR' ? t('cart.brazil') : t('cart.international')} (
              {formatPrice(d === 'BR' ? SHIPPING_BR_CENTS : SHIPPING_INTL_CENTS, lang)})
            </label>
          ))}
        </Card>
      )}

      <Card className="space-y-1 text-sm">
        <div className="flex justify-between"><span>{t('cart.items')}</span><span>{formatPrice(itemsCents, lang)}</span></div>
        <div className="flex justify-between"><span>{t('cart.shipping')}</span><span>{formatPrice(shippingCents, lang)}</span></div>
        <div className="flex justify-between font-bold"><span>{t('cart.total')}</span><span>{formatPrice(itemsCents + shippingCents, lang)}</span></div>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button className="w-full" onClick={checkout} disabled={submitting}>
        {submitting ? t('cart.redirecting') : t('cart.checkout')}
      </Button>
      <p className="text-center text-xs text-stone-500">{t('cart.realMoney')}</p>
    </div>
  )
}
