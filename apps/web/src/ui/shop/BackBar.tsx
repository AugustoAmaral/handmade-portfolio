import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { routes } from '../routes'

/**
 * The ruled mono strip that sits under the header on every page that is not the home page. The
 * file map forgot it and it appears three times in the prototype: byte-identical at the top of the
 * product and about pages, and once more on the checkout with different contents.
 *
 * IT IS NOT A `<nav>`. A landmark has to earn its place in the rotor, and a strip holding one link
 * does not; worse, a second unnamed `<nav>` beside the header's is precisely the shape that makes
 * axe's `landmark-unique` fire, so it would have to be named as well — a name invented for a
 * landmark nobody asked for.
 *
 * THE OPACITY MOVED OFF THE CONTAINER. The prototype puts `opacity:.7` on the whole strip, and
 * element opacity dims the strip's bottom border with it, so the 1px rule under the bar renders at
 * 70% ink directly above the full-ink rule under the band below it. That is what putting opacity on
 * a container does, not a decision anyone made; the hairline is the design's structural rule and it
 * is full ink everywhere else. So the 70% travels with the text, where it measures 6.21:1 on paper
 * and clears the 4.5:1 floor at 11px with room to spare.
 */
export function BackBar({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono border-ink px-gutter flex flex-wrap justify-between gap-4 border-b py-4 text-[11px] uppercase tracking-[0.14em]">
      {children}
    </div>
  )
}

/**
 * The `← Catálogo` bar, identical at the top of the product page and the about page.
 *
 * A REAL `<a href>`, where the prototype has a `<span onClick>` — no destination to copy, no
 * middle-click, no Tab stop, invisible to a crawler. `LinkInterceptor` upgrades it at the app root,
 * which is the whole reason navigation on this branch is anchors and not callbacks.
 *
 * THE ARROW IS `aria-hidden`, so the link is named `Catálogo` and not "seta para a esquerda
 * Catálogo". It stays in the markup because it is what tells a sighted reader the link goes back
 * rather than sideways — the same split `CartDrawer` makes for its `✕`.
 */
export function CatalogBackBar() {
  const { t } = useTranslation()
  return (
    <BackBar>
      <a href={routes.home()} className="opacity-70">
        <span aria-hidden="true">←</span> {t('Catalogue')}
      </a>
    </BackBar>
  )
}
