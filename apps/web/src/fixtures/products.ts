import type { PublicProduct } from '@shop/shared'
import { deepFreeze } from './freeze'

// Sample data for stories and tests. Content mirrors the approved prototype's catalogue.
// Every product carries its OWN description and specs: several are built by spreading another
// product, and inheriting the parent's prose put the wrong copy on the wrong product page.
export const letter: PublicProduct = deepFreeze({
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
})

export const drawing: PublicProduct = deepFreeze({
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
})

export const soldOutDrawing: PublicProduct = deepFreeze({
  ...drawing,
  id: 'p-portrait',
  slug: 'retrato-lapis',
  name: { pt: 'Retrato a lápis', en: 'Pencil portrait' },
  subtitle: { pt: 'A4 · sob encomenda', en: 'A4 · made to order' },
  description: {
    pt: 'Retrato a grafite sobre papel A4, desenhado a partir de uma foto que você me manda. A tiragem deste ano acabou.',
    en: 'A graphite portrait on A4 paper, drawn from a photo you send me. This year’s run is sold out.',
  },
  priceCents: 18000,
  stock: 0,
  specs: [
    { key: { pt: 'Técnica', en: 'Medium' }, value: { pt: 'Grafite sobre papel', en: 'Graphite on paper' } },
    { key: { pt: 'Formato', en: 'Format' }, value: { pt: 'A4, 21 × 29,7 cm', en: 'A4, 21 × 29.7 cm' } },
    { key: { pt: 'Prazo', en: 'Lead time' }, value: { pt: '3 semanas', en: '3 weeks' } },
  ],
  photos: [],
})

export const digitalLetter: PublicProduct = deepFreeze({
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
})

export const inactiveGuide: PublicProduct = deepFreeze({
  ...digitalLetter,
  id: 'p-guide',
  slug: 'guia-nanquim-pdf',
  name: { pt: 'Guia de nanquim (PDF)', en: 'India ink guide (PDF)' },
  subtitle: { pt: 'Download · 24 páginas', en: 'Download · 24 pages' },
  description: {
    pt: 'Guia em PDF com o material, os traços e os exercícios que uso para desenhar a nanquim. Saiu de catálogo.',
    en: 'A PDF guide to the materials, strokes and exercises I use to draw in India ink. No longer on sale.',
  },
  priceCents: 1800,
  specs: [
    { key: { pt: 'Formato', en: 'Format' }, value: { pt: 'PDF, 24 páginas', en: 'PDF, 24 pages' } },
    { key: { pt: 'Idioma', en: 'Language' }, value: { pt: 'Português e inglês', en: 'Portuguese and English' } },
  ],
  active: false,
})

// Its own object, deliberately not an alias of `soldOutDrawing`: two named fixtures pointing at
// one object let a story that mutates one corrupt the other, and it also conflates two separate
// scenarios — a story about the missing-photo placeholder should not silently also be testing
// the sold-out state.
export const productWithoutPhotos: PublicProduct = deepFreeze({
  ...letter,
  id: 'p-no-photo',
  slug: 'caderno-costurado',
  name: { pt: 'Caderno costurado', en: 'Hand-sewn notebook' },
  subtitle: { pt: 'A5 · 80 páginas', en: 'A5 · 80 pages' },
  description: {
    pt: 'Caderno costurado à mão, capa de papelão revestido e miolo de papel pólen. Ainda não fotografei este.',
    en: 'A hand-sewn notebook with a covered board cover and cream paper inside. I have not photographed this one yet.',
  },
  specs: [
    { key: { pt: 'Formato', en: 'Format' }, value: { pt: 'A5, 80 páginas', en: 'A5, 80 pages' } },
    { key: { pt: 'Costura', en: 'Binding' }, value: { pt: 'Costura copta, à vista', en: 'Exposed Coptic stitch' } },
    { key: { pt: 'Papel', en: 'Paper' }, value: { pt: 'Pólen 90g', en: '90gsm cream paper' } },
  ],
  photos: [],
  featured: false,
})

export const products: PublicProduct[] = deepFreeze([letter, drawing, soldOutDrawing, digitalLetter])

// Twelve spec rows, which is `productInputSchema`'s cap exactly — the admin's specs editor
// disables its add button here, and no other fixture reaches it. Its own description and its own
// specs array, like every fixture above: this one exists to be AT the limit, not to also be a
// story about missing photos.
export const productWithMaxSpecs: PublicProduct = deepFreeze({
  ...letter,
  id: 'p-letter-box',
  slug: 'caixa-de-cartas',
  name: { pt: 'Caixa de cartas', en: 'Letter box' },
  subtitle: { pt: 'Doze cartas · caixa costurada', en: 'Twelve letters · sewn box' },
  description: {
    pt: 'Doze cartas escritas à mão ao longo de um ano, guardadas numa caixa que eu costuro. A ficha desta peça é a mais longa do catálogo.',
    en: 'Twelve handwritten letters over a year, kept in a box I sew myself. This piece has the longest spec sheet in the catalogue.',
  },
  priceCents: 39000,
  stock: 2,
  specs: [
    { key: { pt: 'Formato', en: 'Format' }, value: { pt: 'A5, 12 cartas', en: 'A5, 12 letters' } },
    { key: { pt: 'Papel', en: 'Paper' }, value: { pt: 'Algodão 180g', en: '180gsm cotton' } },
    { key: { pt: 'Tinta', en: 'Ink' }, value: { pt: 'Nanquim preto', en: 'Black India ink' } },
    { key: { pt: 'Caixa', en: 'Box' }, value: { pt: 'Papelão revestido', en: 'Covered board' } },
    { key: { pt: 'Costura', en: 'Binding' }, value: { pt: 'Linha de algodão', en: 'Cotton thread' } },
    { key: { pt: 'Peso', en: 'Weight' }, value: { pt: '540 g', en: '540 g' } },
    { key: { pt: 'Prazo', en: 'Lead time' }, value: { pt: '4 semanas', en: '4 weeks' } },
    { key: { pt: 'Embalagem', en: 'Packaging' }, value: { pt: 'Papel kraft', en: 'Kraft paper' } },
    { key: { pt: 'Envio', en: 'Shipping' }, value: { pt: 'Correios, com rastreio', en: 'Correios, tracked' } },
    { key: { pt: 'Assinatura', en: 'Signature' }, value: { pt: 'Numerada e assinada', en: 'Numbered and signed' } },
    { key: { pt: 'Idioma', en: 'Language' }, value: { pt: 'Português', en: 'Portuguese' } },
    { key: { pt: 'Trocas', en: 'Returns' }, value: { pt: '7 dias', en: '7 days' } },
  ],
  photos: [],
  featured: false,
})

// Three photos, which is the smallest number that has a MIDDLE: the photo editor's reorder
// controls disable at the ends, and with two cards every card is an end.
export const productWithThreePhotos: PublicProduct = deepFreeze({
  ...letter,
  id: 'p-triptych',
  slug: 'triptico-nanquim',
  name: { pt: 'Tríptico a nanquim', en: 'India ink triptych' },
  subtitle: { pt: 'Três folhas · A5', en: 'Three sheets · A5' },
  description: {
    pt: 'Três desenhos a nanquim que só fazem sentido juntos, vendidos como uma peça só. Fotografei os três lado a lado.',
    en: 'Three India ink drawings that only make sense together, sold as one piece. I photographed all three side by side.',
  },
  priceCents: 26000,
  stock: 1,
  specs: [
    { key: { pt: 'Peças', en: 'Sheets' }, value: { pt: 'Três, A5', en: 'Three, A5' } },
    { key: { pt: 'Técnica', en: 'Medium' }, value: { pt: 'Nanquim sobre algodão', en: 'India ink on cotton' } },
  ],
  photos: [
    { key: 'products/triptych/1.webp', url: 'https://img.example.com/products/triptych/1.webp', alt: { pt: 'Folha da esquerda', en: 'Left sheet' } },
    { key: 'products/triptych/2.webp', url: 'https://img.example.com/products/triptych/2.webp', alt: { pt: 'Folha do meio', en: 'Middle sheet' } },
    { key: 'products/triptych/3.webp', url: 'https://img.example.com/products/triptych/3.webp', alt: { pt: '', en: '' } },
  ],
  featured: false,
})
