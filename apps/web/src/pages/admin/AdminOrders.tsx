import { formatPrice } from '@shop/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Badge, Button, Card } from '../../components/ui'
import { api } from '../../lib/api'

interface AdminOrder {
  id: string
  createdAt: string
  status: 'paid' | 'fulfilled' | 'oversold'
  trackingCode?: string
  customer: { email?: string; name?: string }
  amounts: { totalCents: number }
  items: { slug: string; qty: number }[]
  shippingAddress?: {
    name?: string
    address?: {
      line1?: string
      line2?: string
      city?: string
      state?: string
      postal_code?: string
      country?: string
    }
  } | null
}

const statusColors = {
  paid: 'bg-blue-100 text-blue-800',
  fulfilled: 'bg-green-100 text-green-800',
  oversold: 'bg-red-100 text-red-800',
}

function formatShippingAddress(shippingAddress: NonNullable<AdminOrder['shippingAddress']>): string {
  const a = shippingAddress.address
  const parts = [
    shippingAddress.name,
    a?.line1,
    a?.line2,
    [a?.city, a?.state].filter(Boolean).join(' '),
    a?.postal_code,
    a?.country,
  ].filter(Boolean)
  return parts.join(', ')
}

export function AdminOrders() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => api<{ orders: AdminOrder[] }>('/api/admin/orders'),
  })

  async function fulfill(order: AdminOrder) {
    const trackingCode = prompt(t('admin.trackingPrompt')) ?? undefined
    await api(`/api/admin/orders/${order.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'fulfilled', ...(trackingCode && { trackingCode }) }),
    })
    qc.invalidateQueries({ queryKey: ['admin-orders'] })
  }

  return (
    <div className="space-y-3">
      {data?.orders.map((o) => (
        <Card key={o.id} className="flex items-center justify-between text-sm">
          <div>
            <p className="font-medium">
              {new Date(o.createdAt).toLocaleDateString()} — {o.customer.email}
            </p>
            <p className="text-stone-600">
              {o.items.map((i) => `${i.qty}× ${i.slug}`).join(', ')} · {formatPrice(o.amounts.totalCents, 'en')}
              {o.trackingCode && ` · ${o.trackingCode}`}
            </p>
            {o.shippingAddress && (
              <p className="text-stone-500">
                {t('admin.shipTo')}: {formatShippingAddress(o.shippingAddress)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge className={statusColors[o.status]}>{o.status}</Badge>
            {o.status !== 'fulfilled' && <Button variant="outline" onClick={() => fulfill(o)}>{t('admin.markFulfilled')}</Button>}
          </div>
        </Card>
      ))}
      {data?.orders.length === 0 && <p className="text-stone-500">{t('admin.noOrders')}</p>}
    </div>
  )
}
