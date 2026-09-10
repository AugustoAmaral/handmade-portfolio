import { useTranslation } from 'react-i18next'
import { Eyebrow, FieldLabel, PillButton, TextInput } from '../primitives'

/**
 * Why the login refused, in the two shapes that reach the browser: the API answers
 * `401 INVALID_CREDENTIALS` for a wrong pair and anything else is the API being unavailable.
 *
 * A CODE AND NOT A SENTENCE, which is the half that matters. The container that fills this prop
 * lives outside `src/ui`, and `test/copy.test.ts` only scans `src/ui` — a sentence resolved in a
 * container is invisible to the scanner, so a missing Portuguese translation ships as fluent
 * English with nothing red anywhere. The switch below keeps every string on the scanned side.
 */
export type LoginError = 'invalid-credentials' | 'unavailable'

export interface LoginValues {
  email: string
  password: string
}

export interface LoginCardProps {
  values: LoginValues
  onChange(field: keyof LoginValues, value: string): void
  /** The credentials are the container's; this only says that the person asked to send them. */
  onSubmit(): void
  /** A login is in flight. Blocks a second one and says so on the button. */
  pending?: boolean
  error?: LoginError
  /**
   * The last session ended because the API refused its token, rather than because anyone signed
   * out — the flag the session hook raises so this screen can say why it is the screen showing.
   */
  sessionEnded?: boolean
}

type Translate = ReturnType<typeof useTranslation>['t']

/**
 * Literal `t()` calls in a switch, not a table keyed by `LoginError`: the copy scan reads keys out
 * of call sites and pins the number of runtime-built ones at exactly one, so a lookup object would
 * take both sentences out of the scan. `NoticePage` makes the same trade for the same reason.
 *
 * `unavailable` reuses the sentence the checkout already says when the API breaks. One failure,
 * one wording, wherever the reader meets it.
 */
function messageFor(error: LoginError, t: Translate): string {
  switch (error) {
    case 'invalid-credentials':
      return t('That e-mail and password do not match.')
    case 'unavailable':
      return t('Something broke on my side. Try again in a moment.')
  }
}

/**
 * THE ADMIN LOGIN — INVENTED, NOT TRANSCRIBED. The prototype has no login: `senha`, `login`,
 * `token`, `entrar`, `sair`, `logout` and `password` return zero hits across its 975 lines, and the
 * admin is entered by flipping a flag with no gate. There is no field, no button, no error and no
 * signed-out state to copy from. So the vocabulary is borrowed rather than the layout: the dark
 * bar's own mono eyebrow, the display headline every other first screen on the branch opens with,
 * the checkout's label-above-field pair, one 1px ink rule around the lot, and the solid pill the
 * checkout uses for its single call to action. Nothing new is drawn.
 *
 * IT IS A REAL `<form>` WITH A REAL SUBMIT BUTTON INSIDE IT, and that is the one structural
 * decision. The checkout could not do this — its button is several components away from its fields
 * and reaches its form through `PillButton`'s `form` prop — but here the two live together, so
 * Enter submits with nothing wired for it.
 *
 * THERE IS NO SECOND `pending` GUARD IN THE SUBMIT HANDLER, and that is measured rather than
 * assumed. One was written first, on the reasoning that a disabled button stops a click but Enter
 * never touches the button. That reasoning is wrong: implicit submission looks for the form's
 * default button, and a disabled default button means the form is not submitted at all. Deleting
 * the guard left all ten stories green, which is the definition of a branch nothing can reach —
 * and it makes `Pending` a stronger assertion, since `disabled` is now the only thing holding the
 * line and dropping it reddens the story instead of being caught by dead code.
 *
 * THE FIELDS ARE NOT DISABLED WHILE PENDING. Disabling a focused field moves focus away from it,
 * and a login answers in a few hundred milliseconds, so the reader would be thrown out of the form
 * and back on every attempt.
 */
export function LoginCard({ values, onChange, onSubmit, pending = false, error, sessionEnded = false }: LoginCardProps) {
  const { t } = useTranslation()
  return (
    <form
      className="border-ink bg-paper mx-auto flex w-full max-w-[420px] flex-col gap-7 border p-[clamp(24px,5vw,40px)]"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <div>
        <Eyebrow className="mb-4">{t('Panel')}</Eyebrow>
        <h1 className="font-display text-[clamp(28px,4vw,38px)] leading-[1.05]">{t('Sign in to the panel')}</h1>
      </div>
      {/* One slot, and the error wins it. Both can be true at once — a session that was refused and
          then a mistyped password — and at that point the notice is explaining a screen the reader
          is already looking at while the error is about the thing they just did.

          `role="alert"` on the error and nothing on the notice, on purpose: the error appears in a
          card that is already on screen and has to interrupt, while the notice is present in the
          first frame this card ever paints, and a live region that mounts with its content in it
          is not announced by anything. Marking it up as one would buy a role and no announcement. */}
      {error ? (
        <p role="alert" className="font-mono border-accent text-accent border-l-2 pl-3 text-[12px] leading-[1.5]">
          {messageFor(error, t)}
        </p>
      ) : sessionEnded ? (
        <p className="font-mono border-ink border-l-2 pl-3 text-[12px] leading-[1.5] opacity-80">
          {t('Your session ended. Sign in again.')}
        </p>
      ) : null}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor="admin-email">{t('E-mail')}</FieldLabel>
          {/* `username` and not `email`: the autofill spec reserves the username token for the
              identifier half of a sign-in pair, and it is what pairs with `current-password` for a
              password manager. The field is still `type="email"` for the keyboard it summons. */}
          <TextInput
            id="admin-email"
            type="email"
            autoComplete="username"
            value={values.email}
            onChange={(value) => onChange('email', value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor="admin-password">{t('Password')}</FieldLabel>
          <TextInput
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={values.password}
            onChange={(value) => onChange('password', value)}
          />
        </div>
      </div>
      <PillButton type="submit" size="block" disabled={pending}>
        {pending ? t('Signing in…') : t('Sign in')}
      </PillButton>
    </form>
  )
}
