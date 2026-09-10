import { AboutPage } from '../../ui/pages'
import { CONTACT_EMAIL } from '../ShopShellContainer'

/**
 * The about page. No data, no state — every string on it is a `t()` key the provider resolves, and
 * the page takes no `lang` for exactly that reason (its own note checks the union rather than
 * assuming it).
 *
 * `portrait` is left out on purpose: spec:219 makes it a static file Augusto supplies, and until
 * he does, `AboutHero` paints the paper placeholder. Passing a URL for a file that is not in
 * `public/` would render a broken image where a deliberate blank belongs.
 */
export function AboutRoute() {
  return <AboutPage contactEmail={CONTACT_EMAIL} />
}
