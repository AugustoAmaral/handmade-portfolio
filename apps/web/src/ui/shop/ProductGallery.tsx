import type { PublicProduct } from '@shop/shared'
import { useTranslation } from 'react-i18next'
import { ImageFrame } from '../primitives'

export interface ProductGalleryProps {
  product: PublicProduct
  lang: 'pt' | 'en'
  /**
   * Index into `product.photos`. An index the current product has no photo for falls through to
   * the placeholder rather than throwing — that is what a selection held over from the previous
   * product looks like, and the container that owns it (Task 11) is free to reset it or not.
   */
  selectedPhoto: number
  onSelectPhoto(index: number): void
}

/**
 * The product page's left panel: one large photo over a strip of thumbnails that choose it.
 *
 * SELECTION IS NEW WORK. The prototype has a static main slot and two decorative thumbs, and no
 * notion of a current photo at all; three decisions follow from adding one.
 *
 * THE THUMBS ARE TOGGLE BUTTONS, not a radio group and not a tablist. Both of those are the more
 * precise pattern on paper, and neither is buildable in this layer: each owes the reader arrow-key
 * navigation across a single tab stop, which needs a handle on the rendered nodes and somewhere to
 * keep the roving index — the two things `test/ui-boundaries.test.ts` exists to forbid under
 * `src/ui`. A row of `aria-pressed` buttons needs nothing but markup, every thumb stays reachable
 * by Tab, and the pressed state is what announces the selection: focus stays on the button the
 * reader just activated, so the change is read back on the control that caused it. No live region,
 * for the same reason.
 *
 * THE SELECTED THUMB IS NOT MARKED BY OPACITY. Opacity is this design's whole vocabulary for
 * "muted", and it is also the first thing on this branch to fail contrast — PR 2 and Tasks 5 and 6
 * raised nine of them between them. The marker here is a 2px accent ring painted as an inset
 * shadow: a shadow occupies no space, so nothing in the row moves by a pixel when the selection
 * changes, where swapping the border from 1px to 2px would have resized every frame beside it.
 * Computed, not eyeballed, with the method that reproduces the three contrast figures already
 * measured on this branch: accent on the paper the ring is drawn over is 5.58:1, and 5.24:1 where
 * it meets the paper-2 panel — both well clear of the 3:1 WCAG 2.2 SC 1.4.11 asks of a non-text
 * indicator. It is not hue alone either: against the hairline it replaces, an unselected frame's
 * `ink/20` over paper, it is 3.68:1 of plain lightness, so it survives being seen in greyscale. The ring is also the one thing here a Tailwind class can
 * silently fail to emit, so the stories measure the computed shadow instead of trusting it.
 * `outline` was the other candidate and is deliberately left free: it is the focus indicator on
 * every field of this branch, and a selected thumb that painted its own would have hidden focus on
 * the one control most likely to have it.
 *
 * ALT TEXT SPLITS BY CONTEXT, exactly as it does between `Hero` and `ProductCard`, and the two
 * halves of this component land on opposite sides of the split. The main photo stands alone in its
 * cell with nothing else naming it, so it takes `photo.alt[lang]` and falls back to the planted
 * `Photo of {{name}}` — Hero's case. Each thumb is inside a button that must carry an accessible
 * name of its own, and that name says what the control does and which photo it reaches, so the
 * image within it is `alt=""` — ProductCard's case, one level down. Letting the image name the
 * button instead was the tempting shortcut and it is wrong twice: the name would describe a picture
 * rather than an action, and a photo whose `alt` is empty (the schema allows it, and `drawing` has
 * one) would leave the button with no name at all, which is `button-name` failing the build.
 *
 * A PRODUCT WITH NO PHOTOS gets `ImageFrame`'s paper placeholder, per spec:219. Not the prototype's
 * `placeholder="{{ prod.name }}"`: that is an editor stub, and rendering it would print the piece's
 * name a second time immediately under the `<h1>` that already says it.
 *
 * ONE THUMB PER PHOTO, where the prototype draws two thumbs beside a separate main slot. Once the
 * thumbs choose the photo, a photo with no thumb is a photo no one can get back to. A single-photo
 * product therefore has no strip at all rather than one permanently-pressed button that does
 * nothing when clicked.
 */
export function ProductGallery({ product, lang, selectedPhoto, onSelectPhoto }: ProductGalleryProps) {
  const { t } = useTranslation()
  const photos = product.photos
  const current = photos.at(selectedPhoto)
  const name = product.name[lang]
  return (
    <div className="bg-paper-2 flex flex-col items-center justify-center gap-4 p-[clamp(24px,4vw,56px)]">
      <div className="border-ink/20 bg-paper w-full max-w-[400px] border">
        <ImageFrame src={current?.url} alt={current?.alt[lang] || t('Photo of {{name}}', { name })} fit="contain" />
      </div>
      {photos.length > 1 ? (
        <div className="flex w-full max-w-[400px] justify-center gap-3">
          {photos.map((photo, index) => {
            const description = photo.alt[lang]
            return (
              <button
                key={photo.key}
                type="button"
                aria-pressed={index === selectedPhoto}
                aria-label={
                  description
                    ? t('Show photo {{index}}: {{description}}', { index: index + 1, description })
                    : t('Show photo {{index}}', { index: index + 1 })
                }
                onClick={() => onSelectPhoto(index)}
                className={`border-ink/20 bg-paper block max-w-[140px] flex-1 border ${
                  index === selectedPhoto ? 'shadow-[inset_0_0_0_2px_var(--color-accent)]' : ''
                }`}
              >
                <ImageFrame src={photo.url} alt="" ratio="1/1" />
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
