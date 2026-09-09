import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { AboutBlocks } from './AboutBlocks'

// The prototype's three blocks verbatim, and NOT the component's arguments — the component takes
// none. That is what makes these assertions evidence: they fail if a key is missing from pt.json,
// if a key is misspelt at the call site, or if a block is wired to the wrong tag or body. A version
// of this component that took the strings as props could only assert them back.
const BLOCKS = [
  {
    tag: '01 · Como funciona',
    title: 'Você pede, eu faço, o correio entrega.',
    body: 'Nada aqui é produzido em lote. Depois do pagamento eu começo a peça, e mando o código de rastreio por e-mail quando despacho. O prazo de cada item está na página dele.',
  },
  {
    tag: '02 · Materiais',
    title: 'Papel de algodão, nanquim, grafite e linha.',
    body: 'Uso papel algodão 180g, tinta nanquim preta, lápis grafite 2H a 6B e linha de algodão. É a lista inteira. Quando entrar cerâmica no catálogo, esta lista muda.',
  },
  {
    tag: '03 · Trocas',
    title: 'Se chegar torto, eu faço de novo.',
    body: 'Peça danificada no transporte ou fora do que combinamos: me escreve em até sete dias e eu refaço ou devolvo o valor. Encomendas personalizadas passam por uma prévia antes de finalizar.',
  },
]

const meta = { component: AboutBlocks, title: 'Shop/AboutBlocks' } satisfies Meta<typeof AboutBlocks>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    const headings = canvas.getAllByRole('heading')
    // Three, and only three. The loop below indexes the first three and would pass just as happily
    // over six, so this is the assertion that keeps the numbered tag from being promoted to a
    // heading "because it looks like one" — six headings on the About page is the shape that turns
    // `heading-order` into a rule nobody can satisfy on the composed page.
    await expect(headings).toHaveLength(BLOCKS.length)

    for (const [index, block] of BLOCKS.entries()) {
      const heading = headings[index]!
      // Level, not just "it is a heading". The page has one <h1> above this band, so <h2> is both
      // the true outline and the only level `heading-order` accepts here.
      await expect(heading.tagName).toBe('H2')
      // toBe, not toHaveTextContent: that one matches by substring, and every title here is a
      // prefix-free sentence exactly long enough for a truncation to slip through it.
      await expect(heading.textContent).toBe(block.title)
      // The tag and the body belong to THIS block. Both lists above stay complete and in order if
      // block 1 is given block 2's body, which is the failure a page of three near-identical
      // blocks is most likely to ship.
      await expect(heading.previousElementSibling?.textContent).toBe(block.tag)
      await expect(heading.nextElementSibling?.textContent).toBe(block.body)
    }
  },
}

// Nine keys, and English is where a missing pt.json entry hides: with `fallbackLng: false` and the
// key as the English sentence, an untranslated key renders as perfectly formed English and no
// console warning. The story above catches that going the other way; this one catches a call site
// whose key text drifted from the entry it was added with, which would show up here as a sentence
// that is subtly not the one in the file.
export const InEnglish: Story = {
  globals: { locale: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
      'You order, I make it, the post office delivers.',
      'Cotton paper, India ink, graphite and thread.',
      'If it arrives crooked, I make it again.',
    ])
    await expect(canvas.getByText('02 · Materials')).toBeInTheDocument()
  },
}
