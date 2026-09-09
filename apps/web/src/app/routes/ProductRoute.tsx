import { useState } from 'react'
import { useParams } from 'react-router'
import { ProductPage } from '../../ui/pages'
import { useProduct } from '../api/queries'
import { useShop } from '../ShopShellContainer'

/**
 * One piece.
 *
 * THE SELECTED PHOTO RESETS WHEN THE PIECE DOES, and that is the decision Task 7 could not make
 * because it owns the gallery and not the state. react-router renders the same element for every
 * `/exhibit/:slug`, so this component stays MOUNTED as the slug changes and the index survives a
 * navigation it has no meaning across. `ProductGallery` reads `photos.at(index)` and degrades to
 * the placeholder, so the bug it produces is silent: "ainda sem foto" over a piece that has two.
 *
 * Reset, not clamp. Clamping fixes only the half that is visible — an index past the end — and
 * leaves the half that is not: two pieces that happen to have the same number of photographs would
 * open the second one on its SECOND photo, chosen by nobody, and nothing on screen would look
 * wrong. The index is a fact about the piece being looked at, so the piece changing ends it.
 *
 * It resets DURING the render rather than after it. An effect would commit one frame of the old
 * index against the new piece first, which for a warm cache is exactly the wrong photograph
 * painted and then swapped. Comparing the rendered slug with the routed one and correcting both in
 * the same pass is React's own documented answer to state that derives from a prop, and it costs a
 * re-render rather than a repaint.
 */
export function ProductRoute() {
  const { slug = '' } = useParams()
  const { lang, addToCart } = useShop()
  const { data: product } = useProduct(slug)
  const [selectedPhoto, setSelectedPhoto] = useState(0)
  const [shownSlug, setShownSlug] = useState(slug)

  if (slug !== shownSlug) {
    setShownSlug(slug)
    setSelectedPhoto(0)
  }

  // A piece that is loading and a slug that is not in the catalogue land in the same place, which
  // is a gap rather than a decision: `ProductPage` requires a product and there is no not-found
  // screen anywhere in the design or the spec. Flagged for Task 13 — a mistyped link deserves a
  // sentence, not a blank page.
  if (!product) return null

  return (
    <ProductPage
      product={product}
      lang={lang}
      selectedPhoto={selectedPhoto}
      onSelectPhoto={setSelectedPhoto}
      onAddToCart={addToCart}
    />
  )
}
