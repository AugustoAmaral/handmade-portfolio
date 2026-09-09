import { HomePage } from '../../ui/pages'
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
 * NOTHING IS RENDERED WHILE THE FIRST FETCH IS IN FLIGHT, and that is the least-bad of three bad
 * options. `HomePage` has no loading prop and no error prop — the design supplies neither state
 * (the extract lists it among the things it does not provide) — so the alternatives are painting
 * `CatalogGrid`'s "nothing here yet" over a shop that is merely still loading, or inventing copy
 * that `copy.test.ts` cannot see, since it only scans `src/ui`. A failed load still lands on the
 * empty-catalogue screen, which is wrong and is flagged for Task 13: a shop that is down and a
 * shop with nothing to sell should not look the same.
 */
export function HomeRoute() {
  const { lang } = useShop()
  const { data, isPending } = useProducts()
  if (isPending) return null
  const products = data ?? []
  return (
    <HomePage
      products={products}
      featured={products.find((product) => product.featured) ?? products[0] ?? null}
      lang={lang}
      contactEmail={CONTACT_EMAIL}
    />
  )
}
