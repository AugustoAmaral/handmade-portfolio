import { formatPrice } from '@shop/shared'

export function Price({ cents, lang, className = '' }: { cents: number; lang: 'pt' | 'en'; className?: string }) {
  return <span className={`font-mono whitespace-nowrap ${className}`}>{formatPrice(cents, lang)}</span>
}
