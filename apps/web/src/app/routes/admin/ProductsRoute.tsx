import { useState } from 'react'
import { AdminProductsPage, LoadingPage, type ProductDeleteResult } from '../../../ui/pages'
import { routes } from '../../../ui/routes'
import { productInputFrom, useAdminProducts, useDeleteProduct, useSaveProduct } from '../../api/queries'
import { useAdmin } from '../../AdminShellContainer'

/**
 * Where the reader is put after a row disappears under them.
 *
 * FOCUS LANDS ON `<body>` AFTER A CONFIRMED DELETE, which `SpecsEditor` reported for row removal
 * and which no stateless layer can fix: the button that was pressed goes with its row, and React
 * has nowhere to put focus. This is the layer that can, and the band's own `+ Novo produto` is the
 * one control on the screen that is always there — including when the last product has just been
 * deleted and the table has become a sentence. It is found by the href the UI built from the same
 * `routes` helper, so a change to the path cannot leave this pointing at nothing.
 *
 * A LINK RATHER THAN THE HEADING OR THE LIVE REGION, and that is the trade: an `<h1>` and a
 * `role="status"` are both better places to LAND, and both would have to be given a `tabindex` from
 * out here — this container reaching into markup it does not own to make it focusable. Focus moves
 * before the row is gone rather than after, so there is no frame in which the body holds it.
 */
function focusAfterDelete(): void {
  document.querySelector<HTMLElement>(`a[href="${routes.adminNewProduct()}"]`)?.focus()
}

/**
 * The products table.
 *
 * THE ERROR BRANCH ASKS FOR DATA, NOT FOR A STATUS — `HomeRoute`'s rule, restated because it is
 * what keeps a failed background refetch from replacing a catalogue the reader is already looking
 * at. `loadFailed` is "there is nothing to show", which is the only state that earns the apology.
 *
 * A SECOND PRESS ON A SWITCH SENDS NOTHING, and this is the answer to the question Task 3 left
 * open. It declined to add a `pendingId` prop and said so: a fast double-click sends two PUTs, both
 * carrying the same `active` — the row has not refetched, so the second press reads the same stale
 * product and flips it the same way. The defect is therefore a duplicate request rather than a
 * wrong result, which is why it is closed HERE instead of by growing the UI a disabled state: the
 * chip's appearance does not change until the list comes back either way, so a disabled chip would
 * be a new thing on screen to explain a request nobody could see.
 *
 * The guard is keyed by PRODUCT and not by the mutation. `useSaveProduct` is one hook for the whole
 * table, so `isPending` alone would swallow a perfectly good toggle of the row beside it — which is
 * a worse bug than the one being fixed, and invisible in a test with one row.
 */
export function ProductsRoute() {
  const { lang } = useAdmin()
  const { data: products, isPending, refetch } = useAdminProducts()
  const save = useSaveProduct()
  const remove = useDeleteProduct()
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | undefined>(undefined)
  const [result, setResult] = useState<ProductDeleteResult | undefined>(undefined)

  if (isPending) return <LoadingPage />

  return (
    <AdminProductsPage
      products={products ?? []}
      lang={lang}
      loadFailed={!products}
      result={result}
      onRetry={() => void refetch()}
      table={{
        confirmingDeleteId,
        onToggleActive: (product) => {
          if (save.isPending && save.variables?.id === product.id) return
          save.mutate({ id: product.id, input: { ...productInputFrom(product), active: !product.active } })
        },
        // The last delete's outcome goes with the question. Leaving "Produto apagado." up while a
        // second confirmation is on screen would have the region describing the wrong row.
        onAskDelete: (product) => {
          setResult(undefined)
          setConfirmingDeleteId(product.id)
        },
        onCancelDelete: () => setConfirmingDeleteId(undefined),
        onConfirmDelete: (product) => {
          // Cleared in the same commit as the request leaves, so the pair is off the screen before
          // it can be pressed again — a second DELETE would 404 a product that is already gone.
          setConfirmingDeleteId(undefined)
          remove.mutate(product.id, {
            onSuccess: () => {
              setResult('deleted')
              focusAfterDelete()
            },
            onError: () => setResult('delete-failed'),
          })
        },
      }}
    />
  )
}
