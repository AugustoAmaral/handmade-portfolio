import type { PublicProduct } from '@shop/shared'
import { CatalogGrid, ClosingBlock, Hero } from '../shop'

export interface HomePageProps {
  products: readonly PublicProduct[]
  /**
   * Resolved by the container, not derived here: spec:58 makes it the first active `featured`
   * product and otherwise the first active one, which is a rule about the catalogue rather than
   * about this page — and `null` is a state the shop really is in until someone ticks the box.
   */
  featured: PublicProduct | null
  lang: 'pt' | 'en'
  /** Configuration, not copy. `ClosingBlock` builds the `mailto:` from it. */
  contactEmail: string
}

/**
 * The home page: hero, catalogue, closing pitch. Three components and no markup of its own — a
 * page that is only a composition is the point of the layer, and it is what lets the whole screen
 * be a story with nothing mocked.
 *
 * THE HEADING OUTLINE IS THE THING THIS PAGE OWNS. `Hero` brings the `<h1>` and the other two
 * bring one `<h2>` each, which is the first three-heading document on this branch and therefore
 * the first place axe's `heading-order` can fire at all — it returns true at index 0 and needs a
 * third heading before a jump is even expressible. Nothing here enforces the order; the ordering
 * IS the composition, so the story asserts it directly.
 *
 * No fragment wrapper element and no `<div>`: the three bands are siblings inside the shell's
 * `<main>`, and a wrapper would be one more box between the hairline grids and the page.
 */
export function HomePage({ products, featured, lang, contactEmail }: HomePageProps) {
  return (
    <>
      <Hero featured={featured} lang={lang} />
      <CatalogGrid products={products} lang={lang} />
      <ClosingBlock contactEmail={contactEmail} />
    </>
  )
}
