import type { OrderStatus } from '@shop/shared'
import { useTranslation } from 'react-i18next'

const LABEL: Record<OrderStatus, string> = {
  pending: 'Awaiting payment',
  paid: 'In production',
  shipped: 'Shipped',
  oversold: 'Insufficient stock',
  expired: 'Expired',
}

const TONE: Record<OrderStatus, string> = {
  pending: 'border border-ink/40 opacity-70',
  paid: 'bg-ink text-paper',
  shipped: 'border border-ink',
  oversold: 'bg-accent text-paper',
  expired: 'border border-ink/30 opacity-65',
}

export function StatusPill({ status }: { status: OrderStatus }) {
  const { t } = useTranslation()
  return (
    <span className={`font-mono inline-flex px-3 py-1 text-[10px] uppercase tracking-[0.12em] ${TONE[status]}`}>
      {t(LABEL[status])}
    </span>
  )
}
