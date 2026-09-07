import type { PublicProduct } from '@shop/shared'
import { formatPrice } from '@shop/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge, Button, Card } from '../../components/ui'
import { api } from '../../lib/api'
import { ProductForm } from './ProductForm'

export function AdminProducts() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<PublicProduct | 'new' | null>(null)
  const { data } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () => api<{ products: PublicProduct[] }>('/api/admin/products'),
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-products'] })
    setEditing(null)
  }

  if (editing)
    return (
      <Card>
        <ProductForm initial={editing === 'new' ? undefined : editing} onSaved={refresh} onCancel={() => setEditing(null)} />
      </Card>
    )

  return (
    <div className="space-y-4">
      <Button onClick={() => setEditing('new')}>{t('admin.newProduct')}</Button>
      {data?.products.map((p) => (
        <Card key={p.id} className="flex items-center justify-between">
          <div>
            <p className="font-medium">{p.name.en}</p>
            <p className="text-sm text-stone-600">
              {formatPrice(p.priceCents, 'en')} · {p.type} · {p.stock === null ? t('admin.madeToOrder') : `stock ${p.stock}`}
              {!p.active && <Badge className="ml-2 bg-yellow-100 text-yellow-800">{t('admin.inactive')}</Badge>}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(p)}>{t('admin.edit')}</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!confirm(t('admin.deleteConfirm'))) return
                await api(`/api/admin/products/${p.id}`, { method: 'DELETE' })
                refresh()
              }}
            >
              {t('admin.delete')}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  )
}
