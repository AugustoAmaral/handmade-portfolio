export function formatPrice(cents: number, locale: 'pt' | 'en'): string {
  return new Intl.NumberFormat(locale === 'pt' ? 'pt-BR' : 'en-US', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100)
}
