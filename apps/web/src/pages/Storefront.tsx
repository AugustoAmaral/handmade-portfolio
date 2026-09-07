import type { PublicProduct } from '@shop/shared'
import { formatPrice } from '@shop/shared'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Badge, Card } from '../components/ui'
import { api } from '../lib/api'
import { useLang } from '../i18n'

export function Storefront() {
  const { t } = useTranslation()
  const lang = useLang()
  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => api<{ products: PublicProduct[] }>('/api/products'),
  })

  if (isLoading) return <p className="text-stone-500">{t('store.loading')}</p>

  return (
    <div>
      <p className="mb-8 font-serif text-xl italic text-stone-600">{t('tagline')}</p>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data?.products.map((p) => (
          <Link key={p.id} to={`/exhibit/${p.slug}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              {p.photos[0] ? (
                <img src={p.photos[0].url} alt={p.name[lang]} className="mb-3 aspect-square w-full rounded-md object-cover" />
              ) : (
                <div className="mb-3 flex aspect-square w-full items-center justify-center rounded-md bg-stone-100 font-serif text-4xl text-stone-300">?</div>
              )}
              <h2 className="font-medium">{p.name[lang]}</h2>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-stone-600">{formatPrice(p.priceCents, lang)}</span>
                {p.stock === 0 && <Badge className="bg-red-100 text-red-700">{t('store.soldOut')}</Badge>}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
