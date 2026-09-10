import { useState } from 'react'
import { useParams } from 'react-router'
import { LoadingPage, NoticePage, ProductPage } from '../../ui/pages'
import { ApiError } from '../api/client'
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
 *
 * A MISTYPED SLUG AND A BROKEN SHOP ARE TWO SCREENS, where Task 11 had one blank page for both.
 * The split is `ApiError.status`, and it decides one thing the reader can act on: a 404 will answer
 * the same way however many times it is asked, so that branch offers the catalogue and no retry,
 * while anything else might work on the next try and offers both. Reading the status off the error
 * rather than treating every failure as "not found" is what keeps the shop from telling a buyer a
 * piece was sold when the API was merely down.
 */
export function ProductRoute() {
  const { slug = '' } = useParams()
  const { lang, addToCart } = useShop()
  const { data: product, isPending, error, refetch } = useProduct(slug)
  const [selectedPhoto, setSelectedPhoto] = useState(0)
  const [shownSlug, setShownSlug] = useState(slug)

  if (slug !== shownSlug) {
    setShownSlug(slug)
    setSelectedPhoto(0)
  }

  if (isPending) return <LoadingPage />
  if (!product) {
    return error instanceof ApiError && error.status === 404 ? (
      <NoticePage kind="product-not-found" />
    ) : (
      <NoticePage kind="product-unavailable" onRetry={() => void refetch()} />
    )
  }

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
