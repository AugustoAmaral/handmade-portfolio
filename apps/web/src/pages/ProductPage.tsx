import type { PublicProduct } from '@shop/shared'
import { formatPrice } from '@shop/shared'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Badge, Button } from '../components/ui'
import { api } from '../lib/api'
import { useLang } from '../i18n'

export function ProductPage() {
  const { slug } = useParams()
  const { t } = useTranslation()
  const lang = useLang()
  const { data, error } = useQuery({
    queryKey: ['product', slug],
    queryFn: () => api<{ product: PublicProduct }>(`/api/products/${slug}`),
  })

  if (error) return <p>{t('product.notFound')}</p>
  if (!data) return <p className="text-stone-500">{t('store.loading')}</p>
  const p = data.product

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="space-y-3">
        {p.photos.length === 0 && (
          <div className="flex aspect-square items-center justify-center rounded-md bg-stone-100 font-serif text-6xl text-stone-300">?</div>
        )}
        {p.photos.map((photo) => (
          <img key={photo.url} src={photo.url} alt={p.name[lang]} className="w-full rounded-md object-cover" />
        ))}
      </div>
      <div>
        <h1 className="font-serif text-2xl font-bold">{p.name[lang]}</h1>
        <p className="mt-1 text-xl text-stone-600">{formatPrice(p.priceCents, lang)}</p>
        <Badge className="mt-2">{p.type === 'physical' ? t('product.shippedByMail') : t('product.deliveredByEmail')}</Badge>
        <p className="mt-4 whitespace-pre-line text-stone-700">{p.description[lang]}</p>
        {/* Wired to useCart in Task 11 */}
        <Button className="mt-6" disabled data-cart-pending>
          {p.stock === 0 ? t('store.soldOut') : t('product.addToCart')}
        </Button>
      </div>
    </div>
  )
}
