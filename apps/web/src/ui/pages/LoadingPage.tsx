import { useTranslation } from 'react-i18next'

/**
 * What stands in for a page while its first request is in flight.
 *
 * IT IS NOT A SCREEN, and that is the difference between this and `NoticePage`. Waiting is a state
 * that ends on its own: it has nothing to say, nowhere to send anyone and no decision to offer, so
 * it gets one mono line and the height the band it replaces would have had — enough that the header
 * does not sit alone against white, not so much that the arriving page jumps.
 *
 * NO HEADING. The page under this one owns the outline and is about to render it; announcing
 * "Carregando" as the document's `<h1>` would put a transient word where the piece's name belongs,
 * and a reader who lands mid-fetch would hear the outline change under them. `role="status"` is the
 * right shape for a transient message and it is the honest one — the caveat is that a live region
 * is reliably announced when its CONTENTS change, and this one arrives already filled, so treat it
 * as correct semantics rather than as a guarantee that every reader hears it.
 *
 * It is a `<div>` carrying the role rather than a `<section>` or a `<p>`: those two have implicit
 * roles of their own, and overriding an implicit role is the shape that trips `aria-allowed-role`.
 * A bare `<div>` has none to override.
 *
 * `surface` PICKS THE GUTTER, and it is the whole reason this component has a prop at all. The two
 * halves of the app do not share one: the shop's `--spacing-gutter` reaches 64px and the panel's
 * `--spacing-gutter-admin` stops at 40px, decided in PR 4 Task 2 because the products table's
 * six-column grid is already tight at its floor. Rendered inside the panel with the shop's gutter,
 * this line starts 24px further in than the band that replaces it — the page visibly steps sideways
 * as it loads, on the widest viewport, which is the one Augusto uses.
 */
export interface LoadingPageProps {
  /** Which half of the app is waiting. The two do not share a gutter. */
  surface?: 'shop' | 'admin'
}

export function LoadingPage({ surface = 'shop' }: LoadingPageProps) {
  const { t } = useTranslation()
  return (
    <div
      role="status"
      className={`flex min-h-[40vh] items-center py-[clamp(40px,7vw,80px)] ${
        surface === 'admin' ? 'px-gutter-admin' : 'px-gutter'
      }`}
    >
      {/* opacity-70 at 11px measures 6.21:1 on paper — the same pairing `BackBar` settled on. */}
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-70">{t('Loading…')}</p>
    </div>
  )
}
