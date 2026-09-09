import {
  type CheckoutRequest,
  type PublicProduct,
  SHIPPING_METHODS,
  computeTotals,
  formatPrice,
  hasPhysicalItems,
  shippingOptionsFor,
} from '@shop/shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'
import {
  brCheckout,
  brCheckoutErrors,
  buyerCheckoutErrors,
  digitalCheckout,
  emptyCheckout,
  incompleteBrCheckout,
  intlCheckout,
} from '../../fixtures/checkout'
import { digitalLetter, drawing, letter, soldOutDrawing } from '../../fixtures/products'
import { lineOf } from '../shop/CartLine.stories'
import { CheckoutPage } from './CheckoutPage'
import { inShopShell } from './ShopShell.stories'

const CATALOGUE = [letter, drawing, soldOutDrawing, digitalLetter]

function productOf(slug: string): PublicProduct {
  const found = CATALOGUE.find((product) => product.slug === slug)
  if (!found) throw new Error(`no fixture product for "${slug}"`)
  return found
}

/**
 * Turns a `CheckoutRequest` fixture into the page's props. The fixtures are the REQUEST shape —
 * that is what makes them checkable by `fixtures.test.ts` against the real schema, and what makes
 * `brCheckoutErrors` derivable from the real rules — and the form's shape is flatter: three flat
 * value bags and a cart the request only names by slug. Doing the conversion here rather than
 * typing eight addresses by hand is what keeps every story on this page describing a request the
 * API would really accept or really reject.
 *
 * `shippingCents` carries the one judgement in it. `null` means "no method chosen yet" and renders
 * the em dash; a digital-only bag has nothing to choose and genuinely costs nothing to post, so it
 * gets `0` rather than a dash beside a prompt to pick an option that does not exist.
 */
function argsFor(request: CheckoutRequest, lang: 'pt' | 'en' = 'pt') {
  const address = request.shippingAddress
  const country = address?.country ?? ''
  const lines = request.items.map((item) => lineOf(productOf(item.slug), item.qty))
  const totals = computeTotals(
    request.items.map((item) => {
      const product = productOf(item.slug)
      return { priceCents: product.priceCents, qty: item.qty, type: product.type }
    }),
    request.shippingMethod ?? null,
  )
  const chosen = request.shippingMethod ?? null
  return {
    lang,
    buyer: { name: request.buyer.name, email: request.buyer.email, phone: request.buyer.phone ?? '' },
    address: {
      country,
      postalCode: address?.postalCode ?? '',
      street: address?.street ?? '',
      number: address?.number ?? '',
      complement: address?.complement ?? '',
      district: address?.district ?? '',
      city: address?.city ?? '',
      state: address?.state ?? '',
    },
    notes: {
      notes: request.notes ?? '',
      giftMessage: request.giftMessage ?? '',
      referral: request.referral ?? '',
    },
    shippingOptions: shippingOptionsFor(country),
    shippingMethod: chosen,
    shippingMethodName: chosen ? SHIPPING_METHODS[chosen].name[lang] : null,
    lines,
    itemsCents: totals.itemsCents,
    shippingCents: chosen || !hasPhysicalItems(lines) ? totals.shippingCents : null,
    totalCents: totals.totalCents,
  }
}

/** `<li><div><span>name</span><span>meta</span></div><span>total</span></li>` — the summary line's
 *  second row, read structurally because `Intl`'s no-break space never survives a text query. */
function metaOf(item: Element): string {
  const meta = item.firstElementChild?.lastElementChild
  if (!meta) throw new Error('the summary line rendered no meta row under the product name')
  return meta.textContent ?? ''
}

/** The `<dd>` beside a totals `<dt>`, the same reader the drawer's and the panel's stories use. */
function valueOf(canvas: { getByText(text: string): HTMLElement }, label: string): HTMLElement {
  const term = canvas.getByText(label)
  const value = term.nextElementSibling
  if (!value) throw new Error(`the totals row "${label}" has no value cell after its label`)
  return value as HTMLElement
}

const BR_TOTALS = computeTotals(
  brCheckout.items.map((item) => {
    const product = productOf(item.slug)
    return { priceCents: product.priceCents, qty: item.qty, type: product.type }
  }),
  brCheckout.shippingMethod ?? null,
)

const meta = {
  component: CheckoutPage,
  title: 'Pages/CheckoutPage',
  decorators: [inShopShell],
  args: {
    ...argsFor(emptyCheckout),
    errors: {},
    submitting: false,
    submitError: null,
    onBuyerChange: fn(),
    onAddressChange: fn(),
    onNotesChange: fn(),
    onSelectShipping: fn(),
    onOpenCart: fn(),
    onSubmit: fn(),
  },
} satisfies Meta<typeof CheckoutPage>
export default meta
type Story = StoryObj<typeof meta>

// The form as you land on it: `emptyCheckout` is the initial state, typed as a request and
// deliberately NOT schema-valid. It carries no address, so the country is blank and there is no
// country to offer options for — which is the branch nothing else on this page reaches.
// ⚠️ Whether the container should pre-fill `BR` instead is Task 11's call; this renders the fixture.
export const EmptyForm: Story = {
  play: async ({ args, canvas }) => {
    // Seven headings: the page's `<h1>`, one per section, and the summary's. Every section is a
    // NAMED region, so `landmark-unique` is satisfied by their names rather than by luck.
    await expect(canvas.getAllByRole('heading').map((h) => h.tagName)).toEqual([
      'H1',
      'H2',
      'H2',
      'H2',
      'H2',
      'H2',
      'H2',
    ])
    await expect(canvas.getByRole('heading', { level: 1 }).textContent).toBe('Para onde eu mando, e para quem.')

    await expect(canvas.getByLabelText('Nome completo')).toHaveValue('')
    await expect(canvas.getByLabelText('País')).toHaveValue('')
    // No country, no options — and the section says so instead of rendering an empty fieldset.
    canvas.getByText('Nenhuma opção de envio para este endereço.')
    await expect(canvas.queryAllByRole('radio')).toHaveLength(0)
    // Nothing chosen yet is a dash plus the sentence behind it, not a zero.
    await expect(valueOf(canvas, 'Frete').textContent).toBe('—Escolha uma opção de envio')

    // The bar's left item opens the drawer over this page, so it is a button and not a link.
    await userEvent.click(canvas.getByRole('button', { name: 'Voltar para a sacola' }))
    await expect(args.onOpenCart).toHaveBeenCalledOnce()
  },
}

export const BrazilFilled: Story = {
  args: argsFor(brCheckout),
  play: async ({ args, canvas }) => {
    await expect(canvas.getByLabelText('Nome completo')).toHaveValue(brCheckout.buyer.name)
    // The Brazilian shape: CEP rather than "Código postal", plus the three fields `checkoutRules`
    // only asks for when the country is BR.
    await expect(canvas.getByLabelText('CEP')).toHaveValue(brCheckout.shippingAddress!.postalCode)
    await expect(canvas.getByLabelText('Número')).toHaveValue(brCheckout.shippingAddress!.number!)
    await expect(canvas.getByLabelText('Bairro')).toHaveValue(brCheckout.shippingAddress!.district!)
    await expect(canvas.getByLabelText('Estado')).toHaveValue(brCheckout.shippingAddress!.state!)

    // Two domestic options, and the fixture's own one is the checked one.
    await expect(canvas.getAllByRole('radio')).toHaveLength(2)
    await expect(canvas.getByRole('radio', { name: /PAC/ })).not.toBeChecked()
    await expect(canvas.getByRole('radio', { name: /SEDEX/ })).toBeChecked()

    // Every number on the right, each against a different one of the three: they arrive already
    // computed and the only mistake available is wiring one into another's row.
    await expect(valueOf(canvas, 'Subtotal').textContent).toBe(formatPrice(BR_TOTALS.itemsCents, 'pt'))
    await expect(valueOf(canvas, `Frete (${SHIPPING_METHODS.sedex.name.pt})`).textContent).toBe(
      formatPrice(BR_TOTALS.shippingCents, 'pt'),
    )
    await expect(valueOf(canvas, 'Total').textContent).toBe(formatPrice(BR_TOTALS.totalCents, 'pt'))

    await userEvent.click(canvas.getByRole('button', { name: /pagar/i }))
    await expect(args.onSubmit).toHaveBeenCalledOnce()
  },
}

// `intlCheckout` is the other schema-valid address shape: five fields, no number, no complement,
// no district — because `checkoutRules` only requires those for BR, and a form that showed them
// to France would collect data the API ignores. Its locale is `en`, so the whole screen is too.
export const InternationalFilled: Story = {
  args: argsFor(intlCheckout, 'en'),
  globals: { locale: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText('Country')).toHaveValue('US')
    await expect(canvas.getByLabelText('Postal code')).toHaveValue(intlCheckout.shippingAddress!.postalCode)
    await expect(canvas.getByLabelText('State / province')).toHaveValue(intlCheckout.shippingAddress!.state!)
    // The three BR-only fields are gone, asserted one by one: a single "fewer inputs" count would
    // pass for a form that dropped the wrong three.
    await expect(canvas.queryByLabelText('Number')).toBeNull()
    await expect(canvas.queryByLabelText('Complement')).toBeNull()
    await expect(canvas.queryByLabelText('District')).toBeNull()
    // One option, and it is the international one.
    await expect(canvas.getAllByRole('radio')).toHaveLength(1)
    await expect(canvas.getByRole('radio', { name: /International/ })).toBeChecked()
    await expect(canvas.getByText('Ship to: outside Brazil')).toBeInTheDocument()
  },
}

// `brCheckoutErrors` is DERIVED by running the real `checkoutRules` over `incompleteBrCheckout`, so
// this is the exact 400 body the API sends — codes, not sentences — and the page is what turns
// each code into the field it belongs to.
export const ValidationErrors: Story = {
  args: { ...argsFor(incompleteBrCheckout), errors: brCheckoutErrors },
  play: async ({ canvas }) => {
    const cep = canvas.getByLabelText('CEP')
    await expect(cep).toHaveAttribute('aria-invalid', 'true')
    // The right sentence on the right field. Four codes, four fields, and the mistake this catches
    // is the one that reads perfectly: every message present, one row out of step.
    await expect(canvas.getByText('Informe um CEP válido, como 30150-904.').id).toBe(
      cep.getAttribute('aria-errormessage'),
    )
    await expect(canvas.getByLabelText('Número').getAttribute('aria-errormessage')).toBe(
      canvas.getAllByText('Campo obrigatório.')[0]!.id,
    )
    await expect(canvas.getByText('Use a sigla do estado, como MG.').id).toBe(
      canvas.getByLabelText('Estado').getAttribute('aria-errormessage'),
    )
    // The shipping error is not on a field — it is on the group, and it is announced.
    await expect(canvas.getByRole('alert').textContent).toBe('Campo obrigatório.')
  },
}

// The OTHER shape the page can receive, derived the same way: zod's own issues, keyed
// `buyer.name` / `buyer.email`, whose messages are raw English prose because the API copies
// `issue.message` straight through. The translation table renders anything it does not recognise
// rather than dropping it — a field outlined in accent with nothing beside it is worse than a
// sentence in the wrong language, and the wrong language is the visible symptom that keeps the
// real fix on someone's list.
export const BuyerValidationErrors: Story = {
  args: { errors: buyerCheckoutErrors },
  play: async ({ canvas }) => {
    const name = canvas.getByLabelText('Nome completo')
    await expect(name).toHaveAttribute('aria-invalid', 'true')
    await expect(canvas.getByText(buyerCheckoutErrors['buyer.name']![0]!).id).toBe(
      name.getAttribute('aria-errormessage'),
    )
    await expect(canvas.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true')
    // The two never arrive mixed: the parse runs before the rules, so a request with a bad buyer is
    // rejected before `checkoutRules` is ever called.
    await expect(canvas.queryByText('Informe um CEP válido, como 30150-904.')).toBeNull()
  },
}

export const Submitting: Story = {
  args: { ...argsFor(brCheckout), submitting: true },
  play: async ({ args, canvas }) => {
    const button = canvas.getByRole('button', { name: /pagar/i })
    await expect(button).toBeDisabled()
    // A raw click: `PillButton` paints `pointer-events-none` over a disabled control and user-event
    // throws before reaching the assertion. Two clicks here are two pending orders and two Stripe
    // sessions.
    button.click()
    await expect(args.onSubmit).not.toHaveBeenCalled()
    // The name does not change while it is busy; the busy state is a live region beside it.
    await expect(canvas.getByRole('status').textContent).toBe('Redirecionando para o Stripe')
  },
}

export const OutOfStock: Story = {
  args: { ...argsFor(brCheckout), submitError: 'OUT_OF_STOCK' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert').textContent).toBe(
      'Não tenho estoque suficiente de uma das peças. Diminua a quantidade na sacola.',
    )
    // The form is still filled in and still submittable: the recovery is to change the bag, not to
    // start over.
    await expect(canvas.getByLabelText('Nome completo')).toHaveValue(brCheckout.buyer.name)
    await expect(canvas.getByRole('button', { name: /pagar/i })).toBeEnabled()
  },
}

// The digital-only bag. `hasPhysicalItems(lines)` is false, so `checkoutRules` asks for neither an
// address nor a method — and a page that showed them anyway would collect data the API ignores and
// block a valid submit on fields it never required. The page derives that from the lines rather
// than taking a boolean, which is what `CartLineData.type` was added for.
export const DigitalOnly: Story = {
  args: argsFor(digitalCheckout),
  play: async ({ canvas }) => {
    await expect(canvas.queryByText('02 · Endereço de entrega')).toBeNull()
    await expect(canvas.queryByText('03 · Envio')).toBeNull()
    await expect(canvas.queryByLabelText('País')).toBeNull()
    // Four sections remain, plus the summary and the h1 — the two that went are the two that would
    // have been lying about what is required.
    await expect(canvas.getAllByRole('heading').map((h) => h.tagName)).toEqual(['H1', 'H2', 'H2', 'H2', 'H2'])

    // Nothing to choose and nothing to charge, so a real zero rather than the "not chosen yet" dash.
    await expect(valueOf(canvas, 'Frete').textContent).toBe(formatPrice(0, 'pt'))
    await expect(valueOf(canvas, 'Total').textContent).toBe(formatPrice(digitalLetter.priceCents, 'pt'))
    // And the summary line says which kind of thing it is — the third of the meta line.
    await expect(metaOf(canvas.getByRole('listitem'))).toBe(
      `1 × ${formatPrice(digitalLetter.priceCents, 'pt')} · digital`,
    )
  },
}
