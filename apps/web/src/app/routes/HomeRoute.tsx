import { HomePage, LoadingPage, NoticePage } from '../../ui/pages'
import { useProducts } from '../api/queries'
import { CONTACT_EMAIL, useShop } from '../ShopShellContainer'

/**
 * The catalogue.
 *
 * WHICH PIECE IS FEATURED IS RESOLVED HERE, not in the page: spec:58 makes it the first active
 * `featured` product and otherwise the first active one, which is a rule about the catalogue.
 * `/api/products` already returns only active pieces in catalogue order, so "first" is the list's
 * own order and no second sort is invented on top of it. `null` — an empty catalogue — is a state
 * the shop really is in until something is on sale, and `Hero` renders it.
 *
 * THE THREE ANSWERS ARE NOW THREE SCREENS. Task 11 shipped one — the catalogue — and rendered
 * nothing while the request was in flight and the EMPTY catalogue when it failed, so a shop that
 * was down and a shop with nothing to sell looked identical. `LoadingPage` and `NoticePage` are
 * where those two sentences live, in `src/ui` where `test/copy.test.ts` can see them; a sentence
 * written in this file would ship as fluent English to a Portuguese reader with nothing to notice.
 *
 * THE ERROR BRANCH ASKS FOR DATA, NOT FOR A STATUS. `!data` rather than `isError` is the difference
 * between a shop that survives a failed background refetch and one that replaces a catalogue it
 * already has with an apology: react-query keeps the last good list on a refetch that fails, and
 * the reader who is looking at it should keep looking at it. Nothing to show is the only state that
 * earns the dead end.
 */
export function HomeRoute() {
  const { lang } = useShop()
  const { data: products, isPending, refetch } = useProducts()
  if (isPending) return <LoadingPage />
  if (!products) return <NoticePage kind="catalogue-unavailable" onRetry={() => void refetch()} />
  return (
    <HomePage
      products={products}
      featured={products.find((product) => product.featured) ?? products[0] ?? null}
      lang={lang}
      contactEmail={CONTACT_EMAIL}
    />
  )
}
