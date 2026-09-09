import type { PublicProduct } from '@shop/shared'

// Sample data for stories and tests. Content mirrors the approved prototype's catalogue.
export const letter: PublicProduct = {
  id: 'p-letter',
  slug: 'carta-escrita',
  name: { pt: 'Carta escrita à mão', en: 'Handwritten letter' },
  subtitle: { pt: 'Papel algodão · 2 folhas', en: 'Cotton paper · 2 sheets' },
  description: {
    pt: 'Você me diz o assunto e para quem é. Eu escrevo à mão, em tinta preta, e mando pelo correio.',
    en: 'You tell me the subject and who it is for. I write it by hand in black ink and post it.',
  },
  priceCents: 4500,
  type: 'physical',
  stock: null,
  specs: [
    { key: { pt: 'Formato', en: 'Format' }, value: { pt: 'A5, 2 folhas', en: 'A5, 2 sheets' } },
    { key: { pt: 'Papel', en: 'Paper' }, value: { pt: 'Algodão 180g', en: '180gsm cotton' } },
    { key: { pt: 'Prazo', en: 'Lead time' }, value: { pt: '5 dias úteis', en: '5 business days' } },
  ],
  photos: [
    { key: 'products/letter/1.webp', url: 'https://img.example.com/products/letter/1.webp', alt: { pt: 'Carta sobre a mesa', en: 'Letter on a table' } },
    { key: 'products/letter/2.webp', url: 'https://img.example.com/products/letter/2.webp', alt: { pt: 'Detalhe da tinta', en: 'Ink detail' } },
  ],
  featured: true,
  active: true,
}

export const drawing: PublicProduct = {
  id: 'p-drawing',
  slug: 'desenho-nanquim',
  name: { pt: 'Desenho a nanquim', en: 'India ink drawing' },
  subtitle: { pt: 'A5 · original', en: 'A5 · original' },
  description: {
    pt: 'Desenho original em nanquim sobre papel de algodão. Não é impressão.',
    en: 'An original India ink drawing on cotton paper. Not a print.',
  },
  priceCents: 12000,
  type: 'physical',
  stock: 4,
  specs: [{ key: { pt: 'Peça', en: 'Edition' }, value: { pt: 'Original, única', en: 'One of one' } }],
  photos: [
    { key: 'products/drawing/1.webp', url: 'https://img.example.com/products/drawing/1.webp', alt: { pt: '', en: '' } },
  ],
  featured: false,
  active: true,
}

export const soldOutDrawing: PublicProduct = {
  ...drawing,
  id: 'p-portrait',
  slug: 'retrato-lapis',
  name: { pt: 'Retrato a lápis', en: 'Pencil portrait' },
  subtitle: { pt: 'A4 · sob encomenda', en: 'A4 · made to order' },
  priceCents: 18000,
  stock: 0,
  photos: [],
}

export const digitalLetter: PublicProduct = {
  id: 'p-digital',
  slug: 'carta-digital',
  name: { pt: 'Carta digital', en: 'Digital letter' },
  subtitle: { pt: 'Escaneada · por e-mail', en: 'Scanned · by e-mail' },
  description: {
    pt: 'A mesma carta à mão, escaneada e enviada por e-mail.',
    en: 'The same handwritten letter, scanned and emailed to you.',
  },
  priceCents: 2000,
  type: 'digital',
  stock: null,
  specs: [],
  photos: [],
  featured: false,
  active: true,
}

export const inactiveGuide: PublicProduct = {
  ...digitalLetter,
  id: 'p-guide',
  slug: 'guia-nanquim-pdf',
  name: { pt: 'Guia de nanquim (PDF)', en: 'India ink guide (PDF)' },
  subtitle: { pt: 'Download · 24 páginas', en: 'Download · 24 pages' },
  priceCents: 1800,
  active: false,
}

// Its own object, deliberately not an alias of `soldOutDrawing`: two named fixtures pointing at
// one object let a story that mutates one corrupt the other, and it also conflates two separate
// scenarios — a story about the missing-photo placeholder should not silently also be testing
// the sold-out state.
export const productWithoutPhotos: PublicProduct = {
  ...letter,
  id: 'p-no-photo',
  slug: 'caderno-costurado',
  name: { pt: 'Caderno costurado', en: 'Hand-sewn notebook' },
  subtitle: { pt: 'A5 · 80 páginas', en: 'A5 · 80 pages' },
  photos: [],
}
export const products: PublicProduct[] = [letter, drawing, soldOutDrawing, digitalLetter]
