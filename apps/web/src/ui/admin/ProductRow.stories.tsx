import type { Meta, StoryObj } from '@storybook/react-vite'
import { type ComponentProps, useState } from 'react'
import { expect, fn, userEvent } from 'storybook/test'
import { digitalLetter, drawing, inactiveGuide, letter } from '../../fixtures/products'
import { ProductRow } from './ProductRow'

/**
 * A `<tr>` needs a table around it, and the wrapper is the one `ProductsTable` builds: `block` on
 * the table levels so the row's own `display:grid` is the layout, and the explicit roles that go
 * with that. Rendering the row inside a default `display:table` would test it in a box it never
 * occupies.
 *
 * THE CONFIRMATION IS DRIVEN BY LOCAL STATE HERE, not by `useArgs`: the browser project has no
 * manager to answer an args update, so a two-step driven through args could only ever be frozen at
 * step one. Stories that want to start at step two still pass `confirmingDelete` — it seeds the
 * state — and the interaction stories drive it the way the container will.
 */
const meta = {
  component: ProductRow,
  title: 'Admin/ProductRow',
  args: {
    product: letter,
    lang: 'pt',
    onToggleActive: fn(),
    onAskDelete: fn(),
    onCancelDelete: fn(),
    onConfirmDelete: fn(),
  },
  render: function Render(args: ComponentProps<typeof ProductRow>) {
    const [confirming, setConfirming] = useState(args.confirmingDelete ?? false)
    return (
      <table role="table" className="block w-full">
        <tbody role="rowgroup" className="block">
          <ProductRow
            {...args}
            confirmingDelete={confirming}
            onAskDelete={(product) => {
              setConfirming(true)
              args.onAskDelete(product)
            }}
            onCancelDelete={() => {
              setConfirming(false)
              args.onCancelDelete()
            }}
            onConfirmDelete={(product) => {
              setConfirming(false)
              args.onConfirmDelete(product)
            }}
          />
        </tbody>
      </table>
    )
  },
} satisfies Meta<typeof ProductRow>
export default meta
type Story = StoryObj<typeof meta>

/**
 * `stock: null` on a PHYSICAL piece. The glyph is hidden and the sentence is what gets read, and
 * the sentence is the shop's own `Made to order` rather than a second wording for one fact.
 *
 * The sub-line is the OTHER language's name, not a hardcoded English one: the panel has no toggle
 * and renders in whatever language the shop was left in, so `nameEn` under a Portuguese name is
 * right half the time and prints the same string twice the other half.
 */
export const MadeToOrder: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('∞')).toHaveAttribute('aria-hidden', 'true')
    await expect(canvas.getByText('Sob encomenda')).toBeInTheDocument()
    await expect(canvas.queryByText('Sem limite')).toBeNull()
    await expect(canvas.getByText('Handwritten letter · carta-escrita')).toBeInTheDocument()
    await expect(canvas.getByText('físico')).toBeInTheDocument()
  },
}

/**
 * THE SAME `stock: null`, THE OTHER SENTENCE. This is the branch the plan's original wording would
 * have got wrong: a constant name for `∞` makes the panel say "sob encomenda" about a PDF, which
 * nobody makes to order. `digitalLetter` is exactly that shape in the fixtures — digital, no stock
 * limit — and it is why the accessible name has to read the type.
 */
export const UnlimitedDigital: Story = {
  args: { product: digitalLetter },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('∞')).toHaveAttribute('aria-hidden', 'true')
    await expect(canvas.getByText('Sem limite')).toBeInTheDocument()
    await expect(canvas.queryByText('Sob encomenda')).toBeNull()
    await expect(canvas.getByText('digital')).toBeInTheDocument()
  },
}

// A real count is a number and nothing else — no symbol, no sentence to read instead of it. The
// cell is addressed by position because that is what a table gives you: rowheader, then four cells
// in column order, and stock is the second.
export const CountedStock: Story = {
  args: { product: drawing },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('cell')[1]!.textContent).toBe('4')
    await expect(canvas.queryByText('∞')).toBeNull()
    await expect(canvas.queryByText('Sob encomenda')).toBeNull()
  },
}

/**
 * EVERY CONTROL IN THE ROW IS NAMED AFTER THE PRODUCT IT ACTS ON. Five rows of buttons called
 * `Apagar` are unnavigable, and a row header only helps a reader moving cell by cell — tabbing
 * announces the control and nothing else. The names are composed from the visible word plus the
 * row header through `aria-labelledby`, so they cost no copy key and follow the language.
 *
 * These are equalities through `getByRole`'s name option, which is exact by default: dropping
 * `aria-labelledby` leaves the names as `Editar`, `Apagar` and `Ativo` and every line below fails.
 */
export const NamesEveryControlAfterItsRow: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'Editar Carta escrita à mão' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Apagar Carta escrita à mão' })).toBeInTheDocument()
    await expect(canvas.getByRole('switch', { name: 'Carta escrita à mão Ativo' })).toBeInTheDocument()
  },
}

/**
 * THE PAIR THE WHOLE TABLE'S ACCESSIBILITY TURNS ON. `Editar` navigates, so it is an anchor with a
 * real href — middle-click, open-in-new-tab and copy-link all keep working. The status chip
 * changes the product and navigates nowhere, so it is a control; as a `role="switch"` its state is
 * `aria-checked` rather than a colour, and it says `Ativo`/`Inativo` in words as well.
 *
 * ONE LINK IN THE ROW, not two. The prototype also opens the editor from the product name, which
 * is a second tab stop to the same destination in every row — 20 for the fixture instead of 15 —
 * and a row header that is also a link is a worse row header. The count is the assertion.
 */
export const EditIsALinkTheToggleIsAControl: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('link')).toHaveLength(1)
    await expect(canvas.getByRole('link', { name: /editar/i })).toHaveAttribute('href', '/admin/products/p-letter')
    await expect(canvas.queryByRole('link', { name: /ativo/i })).toBeNull()
    await expect(canvas.queryByRole('link', { name: /apagar/i })).toBeNull()
    await expect(canvas.queryByRole('link', { name: 'Carta escrita à mão' })).toBeNull()
    await expect(canvas.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  },
}

export const Inactive: Story = {
  args: { product: inactiveGuide },
  play: async ({ canvas }) => {
    const toggle = canvas.getByRole('switch', { name: 'Guia de nanquim (PDF) Inativo' })
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await expect(toggle.textContent).toBe('Inativo')
  },
}

export const TogglesActive: Story = {
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('switch'))
    // The product and not a bare id: the container has to send the OPPOSITE of what it reads, and
    // an id alone leaves it re-deriving the current value from a list it may have refetched.
    await expect(args.onToggleActive).toHaveBeenCalledOnce()
    await expect(args.onToggleActive).toHaveBeenCalledWith(letter)
  },
}

/**
 * HOW A DESTRUCTIVE ACTION IS CONFIRMED, end to end, because the design draws no confirmation at
 * all — `it.remove` filters the row out on the first click.
 *
 * The three things this pins, in order: the first press deletes NOTHING; focus lands on the
 * confirmation rather than on the body of the page, which is what makes an inline two-step
 * viable without a dialog; and the question is attached to the confirmation as its description, so
 * it is announced with the control instead of by a live region that would say it twice.
 *
 * Then the way back and the way through, on the same row, because a confirmation that cannot be
 * cancelled is a slower delete.
 */
export const StepsThroughTheConfirmation: Story = {
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Apagar Carta escrita à mão' }))
    await expect(args.onAskDelete).toHaveBeenCalledOnce()
    await expect(args.onAskDelete).toHaveBeenCalledWith(letter)
    await expect(args.onConfirmDelete).not.toHaveBeenCalled()

    const confirm = canvas.getByRole('button', { name: 'Sim, apagar Carta escrita à mão' })
    await expect(confirm).toHaveFocus()
    await expect(confirm).toHaveAccessibleDescription('Apagar de vez?')
    await expect(canvas.queryByRole('button', { name: 'Apagar Carta escrita à mão' })).toBeNull()

    await userEvent.click(canvas.getByRole('button', { name: 'Cancelar Carta escrita à mão' }))
    await expect(args.onCancelDelete).toHaveBeenCalledOnce()
    await expect(args.onConfirmDelete).not.toHaveBeenCalled()
    await expect(canvas.getByRole('button', { name: 'Apagar Carta escrita à mão' })).toBeInTheDocument()
    await expect(canvas.queryByText('Apagar de vez?')).toBeNull()

    await userEvent.click(canvas.getByRole('button', { name: 'Apagar Carta escrita à mão' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Sim, apagar Carta escrita à mão' }))
    await expect(args.onConfirmDelete).toHaveBeenCalledOnce()
    await expect(args.onConfirmDelete).toHaveBeenCalledWith(letter)
  },
}

/**
 * The second step as the container will hand it over — a seeded prop rather than a click — because
 * that is the shape Task 8 fills and nothing else in this file renders it from a cold mount. The
 * row keeps its editor link while it is asking, so the reader can leave the question by doing the
 * other thing.
 */
export const AwaitingConfirmation: Story = {
  args: { confirmingDelete: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Apagar de vez?')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Sim, apagar Carta escrita à mão' })).toHaveFocus()
    await expect(canvas.getByRole('link', { name: 'Editar Carta escrita à mão' })).toBeInTheDocument()
    await expect(canvas.getByRole('switch')).toBeInTheDocument()
  },
}

// Keys are English sentences and `fallbackLng` is false, so a key that drifted from its pt.json
// entry paints flawless English on the Portuguese screen with nothing red anywhere. The sub-line
// flips with the language, which is the assertion no Portuguese story can make.
export const InEnglish: Story = {
  args: { product: digitalLetter, lang: 'en' },
  globals: { locale: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Unlimited')).toBeInTheDocument()
    await expect(canvas.getByText('Carta digital · carta-digital')).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'Edit Digital letter' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Delete Digital letter' })).toBeInTheDocument()
    await expect(canvas.getByRole('switch', { name: 'Digital letter Active' })).toBeInTheDocument()
    await expect(canvas.queryByText('Sem limite')).toBeNull()
  },
}
