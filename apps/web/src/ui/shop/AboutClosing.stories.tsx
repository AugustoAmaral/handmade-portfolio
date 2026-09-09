import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { AboutClosing } from './AboutClosing'

const MAIL_LINK = 'Falar comigo'
const CATALOGUE_LINK = 'Ver o catálogo'

const meta = {
  component: AboutClosing,
  title: 'Shop/AboutClosing',
  args: { contactEmail: 'contato@augustoamaral.com' },
} satisfies Meta<typeof AboutClosing>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, canvasElement, args }) => {
    // getByRole('heading', { level: 2 }) throws on a second one, so this is also the assertion that
    // the band contributes exactly one heading to the About page's outline.
    await expect(canvas.getByRole('heading', { level: 2 }).textContent).toBe(
      'Se você chegou aqui pelo código, e não pela carta.',
    )

    // The design has `href="#"` here and no address anywhere in the file. Whole value asserted,
    // subject and encoding included: rebuilding it with `routes.mailto` would assert that a
    // function equals itself.
    await expect(canvas.getByRole('link', { name: MAIL_LINK })).toHaveAttribute(
      'href',
      `mailto:${args.contactEmail}?subject=Mensagem%20pelo%20site`,
    )
    // The catalogue link is an `<a href>` where the prototype has a `<span onClick>`. toHaveAttribute
    // matches exactly, which matters here more than usual: `/about` contains `/`, so the substring
    // match that `toHaveTextContent` would have used passes for the wrong route.
    await expect(canvas.getByRole('link', { name: CATALOGUE_LINK })).toHaveAttribute('href', '/')

    // Two paragraphs, not one run of text. The design separates them by a 20px gap and they are
    // separate thoughts — what the site is, and what its author is open to.
    const paragraphs = [...canvasElement.querySelectorAll('p')].map((p) => p.textContent)
    await expect(paragraphs).toEqual([
      'Este site é o portfólio: a vitrine, a página de produto, a sacola, o checkout e a integração de pagamento foram construídos por mim, do zero. O nome é uma piada sobre isso — um portfólio feito à mão, que por acaso também vende coisas feitas à mão.',
      'Aceito conversas sobre produto, interface e sistemas web. Também aceito encomendas de carta.',
    ])
  },
}

// `contactEmail` is the component's entire contract, and the story above cannot tell a prop from a
// constant that happens to hold the same address.
export const AnotherAddress: Story = {
  args: { contactEmail: 'oi@exemplo.com' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: MAIL_LINK })).toHaveAttribute(
      'href',
      'mailto:oi@exemplo.com?subject=Mensagem%20pelo%20site',
    )
  },
}

// The mail subject is a translated key, so in English the href changes with the copy — which is
// also what proves the subject is not a hard-coded Portuguese string that every English reader
// would send back.
export const InEnglish: Story = {
  globals: { locale: 'en' },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole('heading', { level: 2 }).textContent).toBe(
      'If you got here through the code, and not through the letter.',
    )
    await expect(canvas.getByRole('link', { name: 'Talk to me' })).toHaveAttribute(
      'href',
      `mailto:${args.contactEmail}?subject=Message%20from%20the%20site`,
    )
    await expect(canvas.getByRole('link', { name: 'See the catalogue' })).toHaveAttribute('href', '/')
  },
}
