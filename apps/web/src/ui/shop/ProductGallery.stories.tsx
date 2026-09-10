import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'
import { drawing, letter, productWithoutPhotos } from '../../fixtures/products'
import { ProductGallery } from './ProductGallery'

// Three photos, which no fixture carries — the richest product in the catalogue has two. Varied by
// spreading rather than added to `src/fixtures/products.ts`, which is the shape `freeze.ts` and
// `fixtures.test.ts` both document for a story that needs a state the fixtures do not have. The
// third photo's alt is deliberately empty: the schema allows it, `drawing` ships one, and it is the
// only way to put both halves of every alt decision this component makes on screen at once.
const threePhotos = {
  ...letter,
  photos: [
    ...letter.photos,
    { key: 'products/letter/3.webp', url: 'https://img.example.com/products/letter/3.webp', alt: { pt: '', en: '' } },
  ],
}

const meta = {
  component: ProductGallery,
  title: 'Shop/ProductGallery',
  args: { product: threePhotos, lang: 'pt', selectedPhoto: 0, onSelectPhoto: fn() },
} satisfies Meta<typeof ProductGallery>
export default meta
type Story = StoryObj<typeof meta>

export const FirstPhotoSelected: Story = {
  play: async ({ canvas, args }) => {
    // The main photo stands alone in its cell with nothing else naming it, so it is named — the
    // Hero side of the alt split.
    await expect(canvas.getByRole('img', { name: 'Carta sobre a mesa' })).toBeInTheDocument()
    // ...and it is the ONLY named image on screen. The thumbs are `alt=""` inside buttons whose own
    // names already say which photo they reach, so naming them too would say everything twice. An
    // image with an empty alt has no role, which is what makes this a count rather than a query.
    await expect(canvas.getAllByRole('img')).toHaveLength(1)

    const thumbs = canvas.getAllByRole('button')
    // One per photo, not the prototype's two beside a separate main slot: once the thumbs choose
    // the photo, a photo with no thumb is a photo nobody can get back to.
    await expect(thumbs).toHaveLength(args.product.photos.length)
    await expect(thumbs.map((thumb) => thumb.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false'])
  },
}

export const ThirdPhotoSelected: Story = {
  args: { selectedPhoto: 2 },
  play: async ({ canvas }) => {
    // The third photo has no alt of its own, which is what puts the planted `Photo of {{name}}` key
    // on screen — the same fallback `Hero` uses, for the same reason, and the reason Task 12 keeps
    // that key. Nothing else on this branch renders it with a name that is not the featured one.
    await expect(canvas.getByRole('img', { name: 'Foto de Carta escrita à mão' })).toBeInTheDocument()
    // Its thumb has no description to carry either, so the button's name falls back to the position
    // alone rather than to nothing at all.
    await expect(canvas.getByRole('button', { name: 'Ver foto 3' })).toBeInTheDocument()
    await expect(canvas.getAllByRole('button').map((thumb) => thumb.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'true',
    ])
  },
}

export const SelectingAThumbReportsItsIndex: Story = {
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getAllByRole('button', { name: /foto/i })[1]!)
    // The index, not just "it fired": a gallery that reports the wrong photo shows the wrong photo,
    // and a bare toHaveBeenCalled() passes for both.
    await expect(args.onSelectPhoto).toHaveBeenCalledWith(1)
  },
}

export const TheSelectedThumbIsDistinguishableWithoutColour: Story = {
  play: async ({ canvas }) => {
    const [first, second] = canvas.getAllByRole('button')
    await expect(first).toHaveAttribute('aria-pressed', 'true')
    await expect(second).toHaveAttribute('aria-pressed', 'false')

    // Opacity is this design's whole vocabulary for "muted" and the first thing on this branch to
    // fail contrast, so the visible marker is an inset accent ring instead — 5.58:1 on the paper it
    // is drawn over, and 3.68:1 of plain lightness against the unselected frame's hairline, so it
    // is not hue alone either. Read off the computed style rather than the class string: a
    // Tailwind arbitrary value that fails to compile leaves the class attribute exactly as written
    // and the element completely unmarked.
    const ring = getComputedStyle(first).boxShadow
    await expect(ring).toContain('inset')
    await expect(ring).toContain('rgb(166, 61, 32)')
    await expect(getComputedStyle(second).boxShadow).toBe('none')
  },
}

export const SinglePhotoHasNoThumbRow: Story = {
  args: { product: drawing },
  play: async ({ canvas }) => {
    // A lone thumb is a permanently-pressed button that cannot change anything it claims to.
    await expect(canvas.queryAllByRole('button')).toHaveLength(0)
    // `drawing`'s only photo carries an empty alt, so the main image falls back here too — a second
    // fixture reaching the same branch, so the fallback is not the three-photo story's local
    // accident.
    await expect(canvas.getByRole('img', { name: 'Foto de Desenho a nanquim' })).toBeInTheDocument()
  },
}

export const NoPhotos: Story = {
  args: { product: productWithoutPhotos },
  play: async ({ canvas, args }) => {
    // spec:219's paper placeholder, not a broken image.
    canvas.getByText('Ainda sem foto')
    await expect(canvas.queryByRole('img')).toBeNull()
    await expect(canvas.queryAllByRole('button')).toHaveLength(0)
    // And not the prototype's `placeholder="{{ prod.name }}"`, which is an editor stub: it would
    // print the piece's name a second time directly under the <h1> that already carries it.
    await expect(canvas.queryByText(args.product.name.pt)).toBeNull()
  },
}

// The hazard this branch has now hit at three interfaces: `lang` is a prop precisely because
// `i18n.resolvedLanguage` is `undefined` whenever the app is in English, so a component that read
// the language off the instance would render an empty name on every English page. Both of this
// component's uses of the prop are on this one story — the photo's own alt, and the name
// interpolated into the fallback — and the copy switches with it, which is what keeps the second
// assertion from passing under a Portuguese instance.
export const InEnglish: Story = {
  args: { lang: 'en', selectedPhoto: 2 },
  globals: { locale: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'Photo of Handwritten letter' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Show photo 2: Ink detail' })).toBeInTheDocument()
  },
}
