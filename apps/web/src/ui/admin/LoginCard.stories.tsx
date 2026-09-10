import type { Meta, StoryObj } from '@storybook/react-vite'
import { type ComponentProps, useState } from 'react'
import { expect, fn, userEvent } from 'storybook/test'
import { LoginCard, type LoginValues } from './LoginCard'

/**
 * Not a fixture, and there is no fixture to reach for: `src/fixtures` holds products, orders and
 * checkouts, and a credential is not catalogue data — it belongs to no schema, is never rendered
 * anywhere else, and would be a fixture file with one consumer forever. The real pair lives in the
 * API's dev seed and is the e2e test's business, not this component's.
 */
const EMPTY: LoginValues = { email: '', password: '' }
const TYPED: LoginValues = { email: 'augusto@example.com', password: 'nao-e-a-senha' }

const meta = {
  component: LoginCard,
  title: 'Admin/LoginCard',
  args: { values: EMPTY, onChange: fn(), onSubmit: fn() },
  // Local state rather than `useArgs`: the vitest browser project has no manager to answer the
  // args-update message, so controlled inputs would stay frozen at their initial value and every
  // typing assertion below would pass without typing anything. Same reason as TextInput's.
  //
  // The parameter is annotated because the base tsconfig sets `declaration: true` and tsc has to
  // be able to name the type.
  render: function Render(args: ComponentProps<typeof LoginCard>) {
    const [values, setValues] = useState(args.values)
    return (
      <LoginCard
        {...args}
        values={values}
        onChange={(field, value) => {
          setValues((current) => ({ ...current, [field]: value }))
          args.onChange(field, value)
        }}
      />
    )
  },
} satisfies Meta<typeof LoginCard>
export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  play: async ({ args, canvas }) => {
    const email = canvas.getByLabelText('E-mail')
    await userEvent.type(email, TYPED.email)

    // The FIELD KEY, not just that something fired. Two fields report through one callback and the
    // mistake on offer is wiring one field's key onto the other's input, which reads as a working
    // form right up to the moment the container posts the password as the e-mail.
    await expect(args.onChange).toHaveBeenLastCalledWith('email', TYPED.email)
    await expect(email).toHaveValue(TYPED.email)
  },
}

/**
 * The reason this component owns a real `<form>` and a real submit button instead of a div and a
 * click handler: Enter submits, and nothing is wired for it. The checkout could not have this — its
 * button is several components away from its fields and reaches the form through `PillButton`'s
 * `form` prop — so this is the first place on the branch where the pair lives together.
 *
 * If `preventDefault` is ever dropped, this does not go red: the form navigates the runner's own
 * page and the suite tears itself down instead. Same hazard `AnchorGuard` exists for on links.
 */
export const SubmitsOnEnter: Story = {
  play: async ({ args, canvas }) => {
    await userEvent.type(canvas.getByLabelText('Senha'), `${TYPED.password}{Enter}`)
    await expect(args.onSubmit).toHaveBeenCalledOnce()
  },
}

export const SubmitsOnTheButton: Story = {
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Entrar' }))
    await expect(args.onSubmit).toHaveBeenCalledOnce()
  },
}

// A password field that is not `type="password"` prints the password on the screen, and no axe rule
// and no other assertion in this file would notice. The autofill tokens are the pair a password
// manager looks for — `username` for the identifier half of a sign-in, not `email`.
export const MasksThePassword: Story = {
  play: async ({ canvas }) => {
    const password = canvas.getByLabelText('Senha')
    await expect(password).toHaveAttribute('type', 'password')
    await expect(password).toHaveAttribute('autocomplete', 'current-password')
    await expect(canvas.getByLabelText('E-mail')).toHaveAttribute('autocomplete', 'username')
  },
}

// `role="alert"` and not just paint: this message appears in a card that is already on the screen,
// after the reader pressed a button, and a sentence that is only drawn tells a screen reader user
// that nothing happened at all. The equality is on the whole string — `toHaveTextContent` matches
// by substring and would be satisfied by any sentence containing this one.
export const InvalidCredentials: Story = {
  args: { values: TYPED, error: 'invalid-credentials' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert').textContent).toBe('E-mail e senha não conferem.')
    await expect(canvas.queryByText('Sua sessão terminou. Entre de novo.')).toBeNull()
  },
}

// The API broke rather than refused, and it says the same sentence the checkout says when the API
// breaks under it. One failure, one wording.
export const Unavailable: Story = {
  args: { error: 'unavailable' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert').textContent).toBe('Algo quebrou do meu lado. Tente de novo em instantes.')
  },
}

/**
 * The copy the session hook has no key for. `rejected` is raised when the API refuses a STORED
 * token, which is a different event from a login that failed — nobody typed anything, the screen
 * simply changed under them — and without a sentence the login just appears, looking like the app
 * forgot where they were.
 *
 * No `role="alert"`, and that is measured rather than lazy: this notice is in the first frame the
 * card ever paints, and a live region that mounts with its content already inside it is not
 * announced by anything. The role would buy the attribute and no announcement.
 */
export const SessionEnded: Story = {
  args: { sessionEnded: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Sua sessão terminou. Entre de novo.')).toBeInTheDocument()
    await expect(canvas.queryByRole('alert')).toBeNull()
  },
}

// Both are true after a refused session followed by a mistyped password, and only one slot exists.
// The error wins: it is about the thing the reader just did, while the notice explains a screen
// they are already looking at.
export const TheErrorReplacesTheSessionNotice: Story = {
  args: { values: TYPED, error: 'invalid-credentials', sessionEnded: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert').textContent).toBe('E-mail e senha não conferem.')
    await expect(canvas.queryByText('Sua sessão terminou. Entre de novo.')).toBeNull()
  },
}

/**
 * The state the design does not draw, for the only async thing on this screen. The button stops
 * taking clicks — and stopping the click is what stops Enter too, because a form whose default
 * button is disabled has no implicit submission at all. Measured: an explicit `if (pending) return`
 * in the submit handler could be deleted with every story still green, so it was, and `disabled` is
 * now the only thing that assertion is holding.
 *
 * THE BUTTON KEEPS ITS NAME AND THE REGION SAYS WHAT IS HAPPENING. This card used to swap the
 * submit to `Entrando…`, which made it the branch's one control that renames itself for an event
 * three others report in a live region. The three assertions below are the three halves of the
 * repair, and the last one is the whole point: the region has to be on the page BEFORE the message
 * arrives, so `Idle` asserts it there and empty.
 */
export const Pending: Story = {
  args: { values: TYPED, pending: true },
  play: async ({ args, canvas }) => {
    const button = canvas.getByRole('button', { name: 'Entrar' })
    await expect(button).toBeDisabled()
    await expect(canvas.getByRole('status').textContent).toBe('Entrando…')

    await userEvent.type(canvas.getByLabelText('Senha'), '{Enter}')
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/**
 * THE REGION EXISTS BEFORE THERE IS ANYTHING TO SAY, which is the assertion `Pending` cannot make
 * on its own. A live region that mounts already holding its message is announced by nothing, so
 * `getByRole('status')` finding the element while pending proves the markup and not the behaviour;
 * only finding it EMPTY beforehand proves the reader would hear the change.
 */
export const TheLiveRegionIsThereBeforeTheMessage: Story = {
  args: { values: TYPED },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status').textContent).toBe('')
    await expect(canvas.getByRole('button', { name: 'Entrar' })).toBeEnabled()
  },
}

export const InEnglish: Story = {
  args: { error: 'invalid-credentials' },
  globals: { locale: 'en' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1 }).textContent).toBe('Sign in to the panel')
    await expect(canvas.getByLabelText('Password')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    await expect(canvas.getByRole('alert').textContent).toBe('That e-mail and password do not match.')
    await expect(canvas.queryByLabelText('Senha')).toBeNull()
  },
}
