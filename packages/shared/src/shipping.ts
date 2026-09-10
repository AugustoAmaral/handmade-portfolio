export const CART_MAX_DISTINCT = 5
export const CART_MAX_QTY = 5

// Curated list — Correios reaches 200+ countries, this is where Augusto is willing to ship.
export const INTL_ALLOWED_COUNTRIES = [
  'US', 'CA', 'MX', 'AR', 'CL', 'CO', 'UY', 'PY', 'PE',
  'GB', 'IE', 'PT', 'ES', 'FR', 'DE', 'IT', 'NL', 'BE', 'AT', 'CH',
  'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'GR',
  'AU', 'NZ', 'JP', 'KR', 'SG',
] as const

export const SHIPPING_METHOD_IDS = ['pac', 'sedex', 'intl'] as const
export type ShippingMethod = (typeof SHIPPING_METHOD_IDS)[number]
export type ShippingScope = 'BR' | 'INTL'

export interface ShippingMethodInfo {
  id: ShippingMethod
  cents: number
  scope: ShippingScope
  name: { pt: string; en: string }
  eta: { pt: string; en: string }
}

// Placeholder prices until Augusto runs the Correios simulator (spec: "Open items").
export const SHIPPING_METHODS: Record<ShippingMethod, ShippingMethodInfo> = {
  pac: {
    id: 'pac', cents: 2200, scope: 'BR',
    name: { pt: 'Correios PAC', en: 'Correios PAC' },
    eta: { pt: '8 a 12 dias úteis', en: '8–12 business days' },
  },
  sedex: {
    id: 'sedex', cents: 4100, scope: 'BR',
    name: { pt: 'Correios SEDEX', en: 'Correios SEDEX' },
    eta: { pt: '3 a 5 dias úteis', en: '3–5 business days' },
  },
  intl: {
    id: 'intl', cents: 6000, scope: 'INTL',
    name: { pt: 'Internacional (Correios)', en: 'International (Correios)' },
    eta: { pt: '2 a 6 semanas', en: '2–6 weeks' },
  },
}

export function isAllowedCountry(country: string): boolean {
  return country === 'BR' || (INTL_ALLOWED_COUNTRIES as readonly string[]).includes(country)
}

export function shippingOptionsFor(country: string): ShippingMethodInfo[] {
  if (country === 'BR') return [SHIPPING_METHODS.pac, SHIPPING_METHODS.sedex]
  if (isAllowedCountry(country)) return [SHIPPING_METHODS.intl]
  return []
}
