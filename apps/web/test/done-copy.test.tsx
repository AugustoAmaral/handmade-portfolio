import { ORDER_STATUSES, type OrderStatus } from '@shop/shared'
import { cleanup, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, describe, expect, it } from 'vitest'
import { copyI18n } from '../src/copy/i18n'
import { publicPaidOrder } from '../src/fixtures/orders'
import { DonePage } from '../src/ui/pages'

// Testing-library only auto-unmounts with `globals: true`, which this project does not use.
afterEach(cleanup)

/**
 * THE ONE THING A STORY CANNOT ASSERT. Every story is a single render, so no story can say that
 * two states differ — and "differ" is the whole property here. `oversold` and `expired` are
 * opposite facts (money taken and the piece delayed; no money taken at all), and the cheap way to
 * write copy for two states at once is one reassuring paragraph that fits both, which would be
 * false in one direction each way. A page that rendered the same sentence for both passes every
 * per-story assertion in `DonePage.stories.tsx`, because each of those only reads its own screen.
 *
 * The pairs are read off the DOM rather than out of `pt.json`, so this also fails if a branch is
 * wired to the wrong key rather than the key being wrong.
 */
function screenCopyFor(status: OrderStatus, gaveUp = false): string {
  render(
    <I18nextProvider i18n={copyI18n}>
      <DonePage order={{ ...publicPaidOrder, status }} lang="pt" gaveUp={gaveUp} />
    </I18nextProvider>,
  )
  const heading = screen.getByRole('heading', { level: 1 })
  const paragraph = heading.nextElementSibling
  if (!paragraph) throw new Error('the headline is not followed by the paragraph it explains')
  const copy = `${heading.textContent}|${paragraph.textContent}`
  cleanup()
  return copy
}

/** The label on the totals row — the one string on the page that is a claim about the money. */
function totalsLabelFor(status: OrderStatus): string {
  render(
    <I18nextProvider i18n={copyI18n}>
      <DonePage order={{ ...publicPaidOrder, status }} lang="pt" gaveUp={false} />
    </I18nextProvider>,
  )
  // The totals row is the FIRST `<dt>`; the delivery and ETA rows follow it.
  const label = screen.getAllByRole('term')[0]?.textContent ?? ''
  cleanup()
  return label
}

describe('the Done page across every order status', () => {
  it('covers every status the shop can produce', () => {
    // A canary, not a tautology: the two tests below enumerate the five states by hand, and a
    // sixth status added to `@shop/shared` would land on one of these screens without anybody
    // deciding which. This is what makes that decision unavoidable.
    expect([...ORDER_STATUSES]).toEqual(['pending', 'paid', 'shipped', 'oversold', 'expired'])
  })

  it('says a different thing for every state that IS a different thing', () => {
    const paid = screenCopyFor('paid')
    const shipped = screenCopyFor('shipped')
    const pending = screenCopyFor('pending')
    const oversold = screenCopyFor('oversold')
    const expired = screenCopyFor('expired')

    // Deliberately identical: `shipped` is this page kept open across a dispatch, and the tracking
    // code the buyer would want is in the e-mail the confirmed paragraph already promises.
    expect(shipped).toBe(paid)

    const distinct = [paid, pending, oversold, expired]
    expect(new Set(distinct).size).toBe(distinct.length)
  })

  it('claims the money only where the money was taken', () => {
    // `oversold` is a PAID order whose stock ran out afterwards, so it keeps the paid label; the
    // delay is about the piece, not about the payment. `expired` never charged anything, and it
    // read `Total pago` until this test existed — the page bucketed the statuses as
    // `status !== 'pending'` and expired fell on the confirmed side of it.
    expect(totalsLabelFor('paid')).toBe('Total pago')
    expect(totalsLabelFor('shipped')).toBe('Total pago')
    expect(totalsLabelFor('oversold')).toBe('Total pago')
    expect(totalsLabelFor('pending')).toBe('Total')
    expect(totalsLabelFor('expired')).toBe('Total')
  })

  it('does not tell an unpaid buyer their order was placed', () => {
    // The first line of the headline is fixed in four of the five states and this is the one that
    // moves it. `Pedido feito` is a statement about a purchase that did not happen.
    expect(screenCopyFor('expired')).not.toContain('Pedido feito')
    expect(screenCopyFor('oversold')).toContain('Pedido feito')
  })
})
