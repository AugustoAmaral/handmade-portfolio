import { useTranslation } from 'react-i18next'
import { Eyebrow, PillButton } from '../primitives'
import { routes } from '../routes'

/**
 * The three dead ends this shop can reach. They are three and not one because the sentence a reader
 * needs is different in each, and a single "algo deu errado" for all three tells a person whose
 * link was mistyped to keep refreshing a piece that was never there.
 */
export type NoticeKind = 'catalogue-unavailable' | 'product-unavailable' | 'product-not-found'

export interface NoticePageProps {
  kind: NoticeKind
  /**
   * Wired by the container to the query's own refetch, and OMITTED where retrying cannot help: a
   * 404 answers the same way however many times it is asked. A "tentar de novo" that is guaranteed
   * to fail is worse than no button, because it makes the reader responsible for a dead end.
   *
   * A callback rather than an `<a href>` on the same route, which is the one case in this design
   * where navigating is not what the reader wants: the address is already correct and re-entering
   * it changes nothing. This is also the only way the retry can exist at all — asking the browser
   * to reload is a global this layer may not touch, so the container owns it.
   */
  onRetry?: () => void
}

type Translate = ReturnType<typeof useTranslation>['t']

/**
 * Every string is a literal `t('…')` call, in a switch rather than a lookup keyed by `kind`.
 * `test/copy.test.ts` scans call sites by regex and pins the number of dynamic ones at exactly one,
 * so a `COPY[kind]` table would be invisible to the scanner and a missing translation would ship as
 * fluent English. The reused key in the two `-unavailable` branches is the checkout's own failure
 * sentence: the shop says the same thing when it breaks, wherever it breaks.
 */
function copyFor(kind: NoticeKind, t: Translate) {
  switch (kind) {
    case 'catalogue-unavailable':
      return {
        eyebrow: t('Something went wrong'),
        headline: t('I could not load the catalogue.'),
        body: t('Something broke on my side. Try again in a moment.'),
      }
    case 'product-unavailable':
      return {
        eyebrow: t('Something went wrong'),
        headline: t('I could not load this piece.'),
        body: t('Something broke on my side. Try again in a moment.'),
      }
    case 'product-not-found':
      return {
        eyebrow: t('Not found'),
        headline: t('This piece is not in the catalogue.'),
        body: t('It may have been sold, or the address is wrong. The catalogue has everything that is for sale.'),
      }
  }
}

/**
 * The screen a page renders instead of itself when there is nothing to render.
 *
 * A REAL SCREEN, which is the whole point of the task that added it: before this, a failed
 * catalogue fell through to `CatalogGrid`'s "nenhuma peça no catálogo ainda" — a shop that is down
 * and a shop with nothing to sell looked identical — and a mistyped product slug rendered nothing
 * at all. Neither the prototype nor the spec draws either state; the extract lists error and loading
 * among the things the design does not provide, so this band is designed rather than transcribed.
 * It borrows the hero's shape (eyebrow, display headline, a paragraph at a readable measure, a row
 * of pills) so a dead end still looks like part of the shop.
 *
 * THE HEADLINE IS AN `<h1>`. This band replaces the page's whole body inside the shell's one
 * `<main>`, so it is the document's only heading and the outline is one level deep — which is also
 * why axe's `heading-order` cannot fire on it, since it takes three headings before a jump is
 * expressible.
 *
 * THE WAY OUT IS THE CATALOGUE, and it is absent from the catalogue's own failure: a link back to
 * the page you are already on is not an escape. `See the catalogue` is the key `AboutClosing`
 * already uses for the same destination, so the two do not drift into two wordings.
 */
export function NoticePage({ kind, onRetry }: NoticePageProps) {
  const { t } = useTranslation()
  const copy = copyFor(kind, t)
  return (
    <section className="border-ink px-gutter flex min-h-[46vh] flex-col justify-center gap-8 border-b py-[clamp(40px,7vw,80px)]">
      <div>
        <Eyebrow className="mb-6">{copy.eyebrow}</Eyebrow>
        <h1 className="font-display mb-6 text-[clamp(32px,5vw,60px)] leading-[1.05] text-balance">{copy.headline}</h1>
        <p className="max-w-[46ch] text-[17px] leading-[1.6] text-pretty opacity-80">{copy.body}</p>
      </div>
      <div className="flex flex-wrap gap-[14px]">
        {onRetry ? <PillButton onClick={onRetry}>{t('Try again')}</PillButton> : null}
        {kind === 'catalogue-unavailable' ? null : (
          <PillButton href={routes.home()} variant="outline">
            {t('See the catalogue')}
          </PillButton>
        )}
      </div>
    </section>
  )
}
