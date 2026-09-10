import type { CheckoutRequest, PublicOrder, PublicProduct } from '@shop/shared'
import { useMutation, useQuery } from '@tanstack/react-query'
import { type ApiError, api } from './client'

// EVERY public GET ANSWERS IN AN ENVELOPE, and these hooks are where it comes off. `products.ts`
// replies `{ products }`, `{ product }` and `orders.ts` replies `{ order }` — one named key, never
// the bare value. Unwrapping here rather than in each container keeps the shape in one place, and
// it is the same split `client.ts` already makes for the error envelope.
export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => (await api<{ products: PublicProduct[] }>('/api/products')).products,
  })
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: async () =>
      (await api<{ product: PublicProduct }>(`/api/products/${encodeURIComponent(slug)}`)).product,
  })
}

// The thank-you page lands the instant Stripe redirects, which is before the webhook has
// necessarily been delivered. Poll while the order is still `pending` and stop once it settles;
// `enabled` keeps the query idle until both halves of the credential are present.
//
// `poll` is the container's stop switch and it cannot be expressed any other way: spec:202 caps the
// wait at about thirty seconds, and the query key is built from the credential, so a container that
// tried to stop by passing `null` would change the key and throw away the order it had already
// loaded. It defaults to true, so the polling contract is unchanged for anything that ignores it.
const DONE_POLL_MS = 2000

export function useOrder(orderNumber: number | null, sessionId: string | null, poll = true) {
  return useQuery({
    queryKey: ['order', orderNumber, sessionId],
    queryFn: async () =>
      (await api<{ order: PublicOrder }>(`/api/orders/${orderNumber}?session_id=${encodeURIComponent(sessionId!)}`))
        .order,
    enabled: orderNumber != null && sessionId != null,
    refetchInterval: (query) => (poll && query.state.data?.status === 'pending' ? DONE_POLL_MS : false),
    retry: false,
  })
}

export function useCheckout() {
  return useMutation<{ url: string; orderNumber: number }, ApiError, CheckoutRequest>({
    mutationFn: (body) => api('/api/checkout', { method: 'POST', body: JSON.stringify(body) }),
  })
}
