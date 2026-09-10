import { AboutBlocks, AboutClosing, AboutFacts, AboutHero, CatalogBackBar } from '../shop'

export interface AboutPageProps {
  /** Configuration, not copy: `AboutClosing` builds the `mailto:` from it, exactly as the home
   *  page's closing band does, so the two mail links on the site are one decision. */
  contactEmail: string
  /** spec:219's static portrait, absent until Augusto supplies it. See `AboutHero`. */
  portrait?: { url: string; alt: string }
}

/**
 * The about page: back bar, hero, three blocks, four facts, closing pitch.
 *
 * NO `lang` PROP, and that is checked rather than assumed. The plan says each page takes the union
 * of what its components need "plus `lang`", and the union here is empty: nothing on this page
 * comes from the catalogue, no price is formatted, and every string is a `t()` key the provider's
 * instance resolves. A `lang` prop would be a parameter no line of this file or of anything under
 * it could read — the kind of seam that gets wired to the wrong value for two years without a
 * single test noticing, because nothing consumes it.
 *
 * THE HEADING OUTLINE IS FIVE DEEP and it is the reason Task 8 refused to promote the blocks'
 * numbered tags: `<h1>` from the hero, then one `<h2>` per block and one for the closing statement.
 * With the tags promoted this band would carry six headings where three belong, and `heading-order`
 * reddens on the composed page while every component story stays green. The facts band contributes
 * none — it is a `<dl>`, and a number over a label is a value, not a section.
 */
export function AboutPage({ contactEmail, portrait }: AboutPageProps) {
  return (
    <>
      <CatalogBackBar />
      <AboutHero portrait={portrait} />
      <AboutBlocks />
      <AboutFacts />
      <AboutClosing contactEmail={contactEmail} />
    </>
  )
}
