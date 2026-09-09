import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { ClosingBlock } from './ClosingBlock'

const LINK = 'me manda uma mensagem'

const meta = {
  component: ClosingBlock,
  title: 'Shop/ClosingBlock',
  args: { contactEmail: 'contato@augustoamaral.com' },
} satisfies Meta<typeof ClosingBlock>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, args }) => {
    const link = canvas.getByRole('link', { name: LINK })

    // The design has `href="#"` here and no address anywhere in the file. The whole value is
    // asserted, subject and encoding included: rebuilding the expected string with `routes.mailto`
    // would assert that a function equals itself.
    await expect(link).toHaveAttribute('href', `mailto:${args.contactEmail}?subject=Mensagem%20pelo%20site`)

    const paragraph = link.parentElement
    if (!paragraph) throw new Error('the closing block rendered the link outside a paragraph')
    // The sentence is three keys with a link in the middle of it. This is what proves it reads as
    // one sentence: both spaces present, the full stop outside the link, nothing dropped.
    await expect(paragraph.textContent).toBe(
      'Eu escrevo, desenho, embalo e despacho. Também escrevi o carrinho, a integração de pagamento e esta página. Se o que você precisa é a segunda parte, me manda uma mensagem.',
    )

    // The statement is what the paragraph beside it is about, so it is a heading and not a large
    // <div> — the prototype's version leaves the page's last band unlabelled.
    await expect(canvas.getByRole('heading', { level: 2 }).textContent).toBe(
      'Feito por uma pessoa só, do desenho ao checkout.',
    )
  },
}

// `contactEmail` is the component's entire contract, and the story above cannot tell a prop from a
// constant that happens to hold the same address. This one can.
export const AnotherAddress: Story = {
  args: { contactEmail: 'oi@exemplo.com' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: LINK })).toHaveAttribute(
      'href',
      'mailto:oi@exemplo.com?subject=Mensagem%20pelo%20site',
    )
  },
}
