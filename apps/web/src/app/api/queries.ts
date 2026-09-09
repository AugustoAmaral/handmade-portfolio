import type { CheckoutRequest, PublicOrder, PublicProduct } from '@shop/shared'
import { useMutation, useQuery } from '@tanstack/react-query'
import { type ApiError, api } from './client'

export function useProducts() {
  return useQuery({ queryKey: ['products'], queryFn: () => api<PublicProduct[]>('/api/products') })
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: () => api<PublicProduct>(`/api/products/${encodeURIComponent(slug)}`),
  })
}

// The thank-you page lands the instant Stripe redirects, which is before the webhook has
// necessarily been delivered. Poll while the order is still `pending` and stop once it settles;
// `enabled` keeps the query idle until both halves of the credential are present.
const DONE_POLL_MS = 2000

export function useOrder(orderNumber: number | null, sessionId: string | null) {
  return useQuery({
    queryKey: ['order', orderNumber, sessionId],
    queryFn: () => api<PublicOrder>(`/api/orders/${orderNumber}?session_id=${encodeURIComponent(sessionId!)}`),
    enabled: orderNumber != null && sessionId != null,
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? DONE_POLL_MS : false),
    retry: false,
  })
}

export function useCheckout() {
  return useMutation<{ url: string; orderNumber: number }, ApiError, CheckoutRequest>({
    mutationFn: (body) => api('/api/checkout', { method: 'POST', body: JSON.stringify(body) }),
  })
}
