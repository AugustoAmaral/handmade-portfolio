import type { OrderStatus } from '@shop/shared'
import { useTranslation } from 'react-i18next'

// Exported for the copy-completeness scan. `t(STATUS_LABELS[status])` is a dynamic call: the
// scanner reads keys out of `t('literal')` call sites and there is no literal here, so these five
// keys would be the one part of the UI's copy nothing checked against pt.json. Exporting the map
// is what lets the test check them the same way it checks every other key.
export const STATUS_LABELS: Record<OrderStatus, string> = {
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
  // Dashed, not merely fainter. `pending` and `expired` are both "outlined pill with muted text",
  // and once the contrast fix lifted `expired` to opacity-65 the two sat at 6.23:1 and 5.26:1
  // against paper — a gap nobody reads as a hierarchy. The border STYLE carries the distinction
  // instead, so it survives whatever the opacities become and does not lean on hue either.
  expired: 'border border-dashed border-ink/40 opacity-65',
}

export function StatusPill({ status }: { status: OrderStatus }) {
  const { t } = useTranslation()
  return (
    <span className={`font-mono inline-flex px-3 py-1 text-[10px] uppercase tracking-[0.12em] ${TONE[status]}`}>
      {t(STATUS_LABELS[status])}
    </span>
  )
}
