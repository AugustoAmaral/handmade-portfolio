import { useState } from 'react'
import { useSearchParams } from 'react-router'
import type { AdminOrderFilter } from '@shop/shared'
import type { DispatchError } from '../../../ui/admin'
import { AdminOrdersPage, LoadingPage } from '../../../ui/pages'
import { ApiError } from '../../api/client'
import { useAdminOrders, useMarkShipped } from '../../api/queries'
import { useAdmin } from '../../AdminShellContainer'

/**
 * The orders screen.
 *
 * THE FILTER IS STATE AND THE SELECTION IS THE URL, which is the split `AdminOrdersPage` argues
 * for: `?order=` is worth linking to and worth going back to, while a filter in the URL would have
 * to be carried forward by every row link or be reset by opening an order.
 *
 * `undefined` IS A REAL MODE AND IS WHERE THE SCREEN OPENS. The API reads no `status` as its own
 * default — everything except `expired` — so the panel's first view already hides the orders
 * nobody can act on. `all` is a different question and `?status=` is a 400.
 *
 * THE TRACKING FORM IS RESET WHEN THE SELECTED ORDER CHANGES, and the reason is `ProductRoute`'s:
 * this component stays MOUNTED as `?order=` changes, so a code typed for one order and left
 * unsent would be sitting in the field of the next one — and that field's whole purpose is to be
 * PATCHed onto whichever order is on screen. It is reset during the render rather than in an
 * effect, so no frame ever shows one order's code under another order's name.
 *
 * A 409 LEAVES THE FORM OPEN. `OrderDetail` derives the affordance from the same `canTransition`
 * the API checks, so `INVALID_TRANSITION` should be unreachable — but a list that went stale in
 * another tab is exactly how it arrives, and `TrackingInlineForm` puts its error outside the
 * editing branch precisely so a container cannot close the form and swallow the explanation.
 */
export function OrdersRoute() {
  const { lang } = useAdmin()
  const [searchParams] = useSearchParams()
  const selectedId = searchParams.get('order') ?? undefined
  const [filter, setFilter] = useState<AdminOrderFilter | undefined>(undefined)
  const { data: orders, isPending, refetch } = useAdminOrders(filter)
  const markShipped = useMarkShipped()
  const [trackingEditing, setTrackingEditing] = useState(false)
  const [trackingCode, setTrackingCode] = useState('')
  const [dispatchError, setDispatchError] = useState<DispatchError | undefined>(undefined)
  const [openFor, setOpenFor] = useState<string | undefined>(selectedId)

  if (selectedId !== openFor) {
    setOpenFor(selectedId)
    setTrackingEditing(false)
    setTrackingCode('')
    setDispatchError(undefined)
  }

  if (isPending) return <LoadingPage surface="admin" />

  return (
    <AdminOrdersPage
      orders={orders ?? []}
      selectedId={selectedId}
      lang={lang}
      filter={filter}
      loadFailed={!orders}
      onFilterChange={setFilter}
      onRetry={() => void refetch()}
      dispatch={{
        trackingEditing,
        trackingCode,
        dispatching: markShipped.isPending,
        dispatchError,
        onStartDispatch: () => {
          setDispatchError(undefined)
          setTrackingEditing(true)
        },
        onChangeTrackingCode: setTrackingCode,
        onConfirmDispatch: () => {
          // The order the URL names, which is the one the pane is showing. `OrderDetail` only
          // renders with an order in hand, so this is unreachable without one; it is a type guard
          // rather than a defence.
          if (!selectedId) return
          setDispatchError(undefined)
          // The code goes out AS TYPED. `useMarkShipped` trims it and omits it when it is empty,
          // and documents why — `''` is a 400 on a shipment that is otherwise legal. A second trim
          // here would be the third copy of a rule this branch has already paid for.
          markShipped.mutate(
            { id: selectedId, trackingCode },
            {
              onSuccess: () => {
                setTrackingEditing(false)
                setTrackingCode('')
              },
              onError: (failure) =>
                setDispatchError(
                  failure instanceof ApiError && failure.code === 'INVALID_TRANSITION'
                    ? 'invalid-transition'
                    : 'unavailable',
                ),
            },
          )
        },
        onCancelDispatch: () => {
          setTrackingEditing(false)
          setTrackingCode('')
          setDispatchError(undefined)
        },
      }}
    />
  )
}
