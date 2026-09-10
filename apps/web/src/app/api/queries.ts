import type {
  AdminOrder,
  CheckoutRequest,
  OrderStatus,
  ProductUpdateInput,
  PublicOrder,
  PublicProduct,
} from '@shop/shared'
import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ApiError, api, isFinalAnswer } from './client'

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
//
// This query carries NO `retry` of its own. It used to carry `retry: false`, written three commits
// before `retryQuery` existed and never justified; once the shared policy arrived it was suppressing
// the repeat of a 5xx — on the one query whose entire job is to keep asking — to prevent the repeat
// of a 4xx that `retryQuery` already prevents.
const DONE_POLL_MS = 2000

export function useOrder(orderNumber: number | null, sessionId: string | null, poll = true) {
  return useQuery({
    queryKey: ['order', orderNumber, sessionId],
    queryFn: async () =>
      (await api<{ order: PublicOrder }>(`/api/orders/${orderNumber}?session_id=${encodeURIComponent(sessionId!)}`))
        .order,
    enabled: orderNumber != null && sessionId != null,
    refetchInterval: (query) => {
      if (!poll) return false
      const { data, error } = query.state
      if (data) return data.status === 'pending' ? DONE_POLL_MS : false
      // NO DATA IS NOT A SETTLED ORDER. Reading `data?.status` on its own made a first lookup that
      // FAILED indistinguishable from one that came back already paid: the interval returned false,
      // nothing ever asked again, and the page went on promising "esta página se atualiza sozinha"
      // for the rest of the thirty seconds while doing nothing at all. Anything that can be over by
      // the next tick earns another tick; a final answer does not, and stopping on it is what keeps
      // this from becoming fifteen requests for an order that does not exist.
      return isFinalAnswer(error) ? false : DONE_POLL_MS
    },
  })
}

export function useCheckout() {
  return useMutation<{ url: string; orderNumber: number }, ApiError, CheckoutRequest>({
    mutationFn: (body) => api('/api/checkout', { method: 'POST', body: JSON.stringify(body) }),
  })
}

// ---------------------------------------------------------------------------------------------
// Admin
//
// The envelopes below are quoted from `apps/api/src/routes/admin/*.ts`, not from the spec:
//
//   POST   /api/admin/login              200 { token }        · 401 INVALID_CREDENTIALS
//   GET    /api/admin/products           200 { products }     · PublicProduct[], unfiltered
//   POST   /api/admin/products           201 { product }      · 409 SLUG_TAKEN
//   PUT    /api/admin/products/:id       200 { product }      · 409 SLUG_TAKEN
//   DELETE /api/admin/products/:id       204 <no body at all>
//   POST   /api/admin/products/:id/photos    201 { product }  · multipart, the WHOLE product back
//   DELETE /api/admin/products/:id/photos    200 { product }  · ?key=, the WHOLE product back
//   GET    /api/admin/orders             200 { orders }       · AdminOrder[]
//   PATCH  /api/admin/orders/:id         200 { order }        · 409 INVALID_TRANSITION
//
// Every admin key starts with 'admin', so the session guard can drop the whole subtree in one call
// when the session ends.
// ---------------------------------------------------------------------------------------------

const ADMIN_PRODUCTS_KEY = ['admin', 'products'] as const
const ADMIN_ORDERS_KEY = ['admin', 'orders'] as const

/**
 * A product write changes both catalogues the app can show. The admin list is the obvious one; the
 * shop's is reachable without a page load, because `AdminHeader`'s "Ver a loja" is a same-origin
 * link and `LinkInterceptor` upgrades it — so a shop left holding this session's pre-edit
 * `{ products }` would paint the old catalogue. `['product']` is a separate prefix from
 * `['products']` and is not covered by invalidating it.
 */
function invalidateProducts(client: QueryClient): void {
  for (const queryKey of [ADMIN_PRODUCTS_KEY, ['products'], ['product']]) {
    void client.invalidateQueries({ queryKey })
  }
}

/**
 * `loginSchema`'s shape, restated rather than imported: `@shop/shared` exports the schema but no
 * type for its input, and `apps/web` does not depend on zod to infer one. Worth exporting from
 * shared instead the next time that package is touched.
 */
export interface AdminCredentials {
  email: string
  password: string
}

export function useAdminLogin() {
  return useMutation<string, ApiError, AdminCredentials>({
    mutationFn: async (body) =>
      (await api<{ token: string }>('/api/admin/login', { method: 'POST', body: JSON.stringify(body) })).token,
  })
}

/** The admin list is NOT `/api/products`, which filters `{ active: true }` and so hides drafts. */
export function useAdminProducts() {
  return useQuery({
    queryKey: ADMIN_PRODUCTS_KEY,
    queryFn: async () => (await api<{ products: PublicProduct[] }>('/api/admin/products')).products,
  })
}

/**
 * Three filters, not two: a named status, `all`, and NOTHING — which the API reads as its own
 * default, every status except `expired`. Absent is therefore not a synonym for `all`, and it has
 * to be absent rather than empty: `status` is parsed with `z.enum([...ORDER_STATUSES, 'all'])
 * .optional()`, so `?status=` is a 400 rather than a default.
 */
export type AdminOrderFilter = OrderStatus | 'all'

export function useAdminOrders(status?: AdminOrderFilter) {
  return useQuery({
    // `?? null` because react-query hashes an `undefined` element to null anyway; saying so keeps
    // the key readable and the two spellings from looking like different caches.
    queryKey: [...ADMIN_ORDERS_KEY, status ?? null],
    queryFn: async () =>
      (await api<{ orders: AdminOrder[] }>(`/api/admin/orders${status ? `?status=${status}` : ''}`)).orders,
  })
}

/**
 * Create and update are one hook because the form is one form; the id is what separates them, and
 * it is the Mongo id rather than the slug — `findProduct` uses `findById`, and the slug is editable,
 * so the two can never be the same handle.
 *
 * `photos` is only meaningful on update (reorder and alt text; adding and removing have their own
 * endpoints). On create the API parses with `productInputSchema`, which strips it.
 */
export interface SaveProductVars {
  id?: string
  input: ProductUpdateInput
}

export function useSaveProduct() {
  const client = useQueryClient()
  return useMutation<PublicProduct, ApiError, SaveProductVars>({
    mutationFn: async ({ id, input }) =>
      (
        await api<{ product: PublicProduct }>(
          id ? `/api/admin/products/${encodeURIComponent(id)}` : '/api/admin/products',
          { method: id ? 'PUT' : 'POST', body: JSON.stringify(input) },
        )
      ).product,
    onSuccess: () => invalidateProducts(client),
  })
}

export function useDeleteProduct() {
  const client = useQueryClient()
  return useMutation<void, ApiError, string>({
    mutationFn: async (id) => {
      // The one 204 on the branch. `res.json()` rejects on an empty body, and it is the parse guard
      // in `client.ts` — written for HTML error pages — that keeps this from surfacing a
      // SyntaxError for a deletion that worked. There is nothing to unwrap.
      await api<unknown>(`/api/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE' })
    },
    onSuccess: () => invalidateProducts(client),
  })
}

/**
 * Multipart. The file field is named `photo` because `upload.single('photo')` is listening for
 * exactly that — any other name leaves `req.file` undefined and the route answers 400 with
 * "Missing photo file", a failure that has nothing to do with the file. The alt text rides as two
 * flat string fields, `altPt` and `altEn`, since multipart has no nested objects.
 *
 * The response is the whole product, not the photo: the route pushes and re-serialises the document.
 */
export interface UploadPhotoVars {
  id: string
  file: File
  alt?: { pt?: string; en?: string }
}

export function useUploadPhoto() {
  const client = useQueryClient()
  return useMutation<PublicProduct, ApiError, UploadPhotoVars>({
    mutationFn: async ({ id, file, alt }) => {
      const body = new FormData()
      body.append('photo', file)
      if (alt?.pt) body.append('altPt', alt.pt)
      if (alt?.en) body.append('altEn', alt.en)
      return (
        await api<{ product: PublicProduct }>(`/api/admin/products/${encodeURIComponent(id)}/photos`, {
          method: 'POST',
          body,
        })
      ).product
    },
    onSuccess: () => invalidateProducts(client),
  })
}

/** The key travels in the query string and MUST be encoded: R2 keys are paths, with slashes in. */
export interface DeletePhotoVars {
  id: string
  key: string
}

export function useDeletePhoto() {
  const client = useQueryClient()
  return useMutation<PublicProduct, ApiError, DeletePhotoVars>({
    mutationFn: async ({ id, key }) =>
      (
        await api<{ product: PublicProduct }>(
          `/api/admin/products/${encodeURIComponent(id)}/photos?key=${encodeURIComponent(key)}`,
          { method: 'DELETE' },
        )
      ).product,
    onSuccess: () => invalidateProducts(client),
  })
}

/**
 * The only status change the admin can make. `canTransition` in `@shop/shared` says from where —
 * `paid` and `oversold` only — and the API refuses the rest with 409 INVALID_TRANSITION, so the
 * caller is expected to consult the same table rather than let the button find out.
 *
 * A blank tracking code is OMITTED, never sent empty: the API parses it as
 * `z.string().trim().min(1).optional()`, so `''` is a 400 on a shipment that is otherwise fine —
 * and blank is the ordinary case for anything handed over in person. Trimming here rather than
 * relying on the schema's is what keeps the padding out of what gets STORED and shown back.
 */
export interface MarkShippedVars {
  id: string
  trackingCode?: string
}

export function useMarkShipped() {
  const client = useQueryClient()
  return useMutation<AdminOrder, ApiError, MarkShippedVars>({
    mutationFn: async ({ id, trackingCode }) => {
      const code = trackingCode?.trim()
      return (
        await api<{ order: AdminOrder }>(`/api/admin/orders/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'shipped', ...(code ? { trackingCode: code } : {}) }),
        })
      ).order
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ADMIN_ORDERS_KEY })
    },
  })
}
