import type { LocalizedText } from '@shop/shared'
import { formatPrice } from '@shop/shared'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { api } from '../lib/api'
import { useCart } from '../lib/cart'
import { useLang } from '../i18n'

interface Summary {
  order: { status: string; totalCents: number; currency: string; items: { name: LocalizedText; qty: number }[] }
}

export function ThanksPage() {
  const { t } = useTranslation()
  const lang = useLang()
  const cart = useCart()
  const [params] = useSearchParams()
  const sessionId = params.get('session_id')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    // The webhook may land a moment after the redirect — poll briefly.
    ;(async () => {
      for (let attempt = 0; attempt < 5 && !cancelled; attempt++) {
        try {
          const data = await api<Summary>(`/api/orders/summary?session_id=${encodeURIComponent(sessionId)}`)
          if (!cancelled) {
            setSummary(data)
            cart.clear()
          }
          return
        } catch {
          await new Promise((r) => setTimeout(r, 2000))
        }
      }
      if (!cancelled) setFailed(true)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  if (!sessionId) return <p>{t('thanks.missingSession')}</p>
  if (failed) return <p>{t('thanks.pending')}</p>
  if (!summary) return <p className="text-stone-500">{t('thanks.confirming')}</p>

  return (
    <div className="mx-auto max-w-md text-center">
      <h1 className="font-serif text-2xl font-bold">{t('thanks.title')}</h1>
      <p className="mt-2 text-stone-600">{t('thanks.body')}</p>
      <ul className="mt-6 space-y-1 text-left">
        {summary.order.items.map((i, idx) => (
          <li key={idx} className="flex justify-between">
            <span>{i.qty}× {i.name[lang]}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 border-t border-stone-200 pt-2 text-right font-bold">
        {formatPrice(summary.order.totalCents, lang)}
      </p>
      <Link to="/" className="mt-6 inline-block underline">{t('cart.backToShop')}</Link>
    </div>
  )
}
