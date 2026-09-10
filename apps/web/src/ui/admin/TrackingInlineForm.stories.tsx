import type { Meta, StoryObj } from '@storybook/react-vite'
import { type ComponentProps, useState } from 'react'
import { expect, fn, userEvent } from 'storybook/test'
import { shippedOrder } from '../../fixtures/orders'
import { MAX_TRACKING_CODE, TrackingInlineForm } from './TrackingInlineForm'

const meta = {
  component: TrackingInlineForm,
  title: 'Admin/TrackingInlineForm',
  args: {
    editing: false,
    value: '',
    onOpen: fn(),
    onChange: fn(),
    onConfirm: fn(),
    onCancel: fn(),
  },
  render: function Render(args: ComponentProps<typeof TrackingInlineForm>) {
    const [value, setValue] = useState(args.value)
    return (
      <TrackingInlineForm
        {...args}
        value={value}
        onChange={(next) => {
          setValue(next)
          args.onChange(next)
        }}
      />
    )
  },
} satisfies Meta<typeof TrackingInlineForm>
export default meta
type Story = StoryObj<typeof meta>

/**
 * THE TWO-STEP THE SPEC ASKS FOR (spec:206): the pill reveals the form, and confirming inside it is
 * what sends the PATCH. The design draws the pill with no handler at all — it and `Responder por
 * e-mail` are the only two hoverable things in the admin with nothing behind them — and no field,
 * no label and no carrier picker anywhere.
 */
export const Closed: Story = {
  play: async ({ args, canvas }) => {
    await expect(canvas.queryByRole('textbox')).toBeNull()
    const open = canvas.getByRole('button', { name: 'Marcar como despachado' })
    await userEvent.click(open)
    await expect(args.onOpen).toHaveBeenCalledTimes(1)
    // Opening is not dispatching. The prototype's single click WOULD have been the whole action.
    await expect(args.onConfirm).not.toHaveBeenCalled()
  },
}

/**
 * FOCUS MOVES INTO THE FORM AS IT OPENS, which is the same problem `ProductRow` solved for its
 * delete confirmation and the same answer: the control that was just pressed is unmounted, so
 * without this the reader is dropped on the body of the page. `autoFocus` does it as the element
 * mounts and needs no handle on a node, which this layer may not hold.
 *
 * The field is focused rather than the confirm button because the next thing to do is type — and
 * because Enter from the field submits the form anyway, so a reader who has nothing to type is one
 * keystroke away either way.
 */
export const Editing: Story = {
  args: { editing: true },
  play: async ({ args, canvas }) => {
    const field = canvas.getByLabelText('Código de rastreio (opcional)')
    await expect(document.activeElement).toBe(field)
    await expect(canvas.getByRole('form', { name: 'Marcar como despachado' })).toBeInTheDocument()

    await userEvent.type(field, shippedOrder.trackingCode!)
    await expect(args.onChange).toHaveBeenLastCalledWith(shippedOrder.trackingCode)
    await expect(field).toHaveValue(shippedOrder.trackingCode)

    await userEvent.click(canvas.getByRole('button', { name: 'Confirmar' }))
    await expect(args.onConfirm).toHaveBeenCalledTimes(1)
  },
}

/**
 * A BLANK CODE IS THE ORDINARY CASE AND MUST GO THROUGH. `trackingCode` is
 * `z.string().trim().min(1).max(60).optional()` on the API, which means ABSENT and not empty — so
 * a form that sent `''` would 400 a shipment that is otherwise perfectly legal, and blank is what a
 * parcel handed over in person has. `useMarkShipped` is where the trim-and-omit happens; it is not
 * repeated here, and what this layer owes is simply not to block the submit.
 *
 * Enter submits it, which the form gets for free from having its own submit button inside it —
 * unlike the checkout, whose button is several components away and needed `PillButton`'s `form`.
 */
export const ConfirmsABlankCode: Story = {
  args: { editing: true },
  play: async ({ args, canvas }) => {
    const field = canvas.getByLabelText('Código de rastreio (opcional)')
    await expect(field).toHaveValue('')
    await expect(canvas.getByRole('button', { name: 'Confirmar' })).toBeEnabled()

    await userEvent.keyboard('{Enter}')
    await expect(args.onConfirm).toHaveBeenCalledTimes(1)
    await expect(args.onChange).not.toHaveBeenCalled()
  },
}

/**
 * THE ONE WAY THIS FIELD CAN BE REJECTED, PREVENTED RATHER THAN REPORTED. The API parses the code
 * at `.max(60)`, and a 400 from that would arrive as a zod `fieldErrors` entry with no slot to land
 * in — the container would flatten it into "algo quebrou do meu lado", which is wrong and
 * unactionable. The cap is on the control instead.
 *
 * Typed rather than read off the attribute: an attribute assertion says the number was written
 * down, and this says the browser is enforcing it. `MAX_TRACKING_CODE` is an UNCHECKABLE copy of
 * the API's 60 — the schema lives in an Express route no web test can import, the same position
 * `MAX_PHOTO_BYTES` is in — so the literal below is the only thing pinning the number itself.
 */
export const StopsAtSixtyCharacters: Story = {
  args: { editing: true },
  play: async ({ canvas }) => {
    await expect(MAX_TRACKING_CODE).toBe(60)
    const field = canvas.getByLabelText('Código de rastreio (opcional)')
    await userEvent.type(field, 'B'.repeat(MAX_TRACKING_CODE + 5))
    await expect((field as HTMLInputElement).value).toHaveLength(MAX_TRACKING_CODE)
  },
}

/** Cancelling closes the form and sends nothing. */
export const Cancelling: Story = {
  args: { editing: true },
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Cancelar' }))
    await expect(args.onCancel).toHaveBeenCalledTimes(1)
    await expect(args.onConfirm).not.toHaveBeenCalled()
  },
}

/**
 * THE BUTTON KEEPS ITS NAME WHILE THE PATCH IS IN FLIGHT, following `OrderSummaryPanel` rather than
 * `LoginCard`: a disabled button is dropped from the accessibility tree by some screen readers, so
 * a label swapped to "Marcando…" may never be read at all, and a control that renames itself is one
 * a voice-control user can no longer ask for. The busy state is a live region beside it, which IS
 * announced.
 *
 * CANCEL IS DISABLED TOO, which is the less obvious half. The PATCH has already left; closing the
 * form would not recall it, and an order that changes state a second after the form was dismissed
 * is worse than a control that is briefly unavailable.
 */
export const Pending: Story = {
  args: { editing: true, pending: true },
  play: async ({ args, canvas }) => {
    const confirm = canvas.getByRole('button', { name: 'Confirmar' })
    await expect(confirm).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    await expect(canvas.getByRole('status').textContent).toBe('Marcando como despachado…')

    // ENTER, NOT A CLICK, and that is the assertion rather than a convenience. A disabled
    // `PillButton` also carries `pointer-events-none`, so a click is refused by the pointer layer
    // before it ever reaches the button — proving nothing about the button. Implicit submission is
    // the path that does not go through the pointer: it looks for the form's default button and
    // does nothing at all when that button is disabled, which is the measurement `LoginCard` made
    // when it deleted its own second `pending` guard as unreachable.
    const field = canvas.getByLabelText('Código de rastreio (opcional)')
    await expect(field).toBeEnabled()
    await expect(document.activeElement).toBe(field)
    await userEvent.keyboard('{Enter}')
    await expect(args.onConfirm).not.toHaveBeenCalled()
  },
}

/**
 * THE 409 THAT CAN STILL HAPPEN AFTER `canTransition` SAID YES. `OrderDetail` only offers this form
 * for the two statuses `ADMIN_ORDER_TRANSITIONS` allows, so the button never lies about the API —
 * but the list it was drawn from is a snapshot, and an order dispatched in another tab is already
 * `shipped` by the time this PATCH lands. The API answers `409 INVALID_TRANSITION` and the sentence
 * says what to do about it rather than repeating the code.
 */
export const RefusedTransition: Story = {
  args: { editing: true, error: 'invalid-transition' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert').textContent).toBe('Este pedido já mudou de situação. Recarregue o painel.')
  },
}

/**
 * The other half of what can come back, and it reuses the checkout's sentence rather than writing a
 * second one: one failure, one wording, wherever the reader meets it. The error survives the form
 * closing, so it is rendered outside the branch — a container that closes the form on failure would
 * otherwise swallow the only explanation.
 */
export const Unavailable: Story = {
  args: { error: 'unavailable' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert').textContent).toBe('Algo quebrou do meu lado. Tente de novo em instantes.')
    await expect(canvas.getByRole('button', { name: 'Marcar como despachado' })).toBeInTheDocument()
  },
}

/** In English the keys render themselves. */
export const InEnglish: Story = {
  globals: { locale: 'en' },
  args: { editing: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('form', { name: 'Mark as shipped' })).toBeInTheDocument()
    await expect(canvas.getByLabelText('Tracking code (optional)')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()
  },
}
