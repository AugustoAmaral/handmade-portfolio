// `aria-errormessage` alone is not enough: axe's aria-valid-attr-value requires the referenced
// message to ALSO use an announcement technique, so `aria-describedby` points at the same node.
// Without it the error is painted but never spoken.
interface Props {
  id: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'email' | 'tel' | 'number' | 'password'
  placeholder?: string
  /**
   * The HTML autofill token for what this field collects (`username`, `current-password`, `email`,
   * …). WCAG 2.2 SC 1.3.5 asks for it on any field collecting information about the person filling
   * it in, and on the admin login it is also what lets a password manager fill the pair at all.
   */
  autoComplete?: string
  error?: string
  disabled?: boolean
}

/**
 * The focus indicator is a real `outline`, not the prototype's border-colour swap. Measured in
 * Chromium, that swap left `outline-style: none` and only moved the 1px border from #1a1713 to
 * #a63d20 — a hue-only signal at 2.81:1 between the unfocused and focused states, where WCAG 2.2
 * asks for 3:1. A 2px accent outline held 2px off the control paints on paper (#f4f0e6) at 5.58:1
 * and changes the control's footprint as well as its colour, so it no longer relies on hue alone.
 * axe ships no rule for this, so only the `FocusRing` story keeps it honest.
 *
 * `outline-none` is deliberately ABSENT rather than merely unnecessary. Tailwind 4 compiles it to
 * `--tw-outline-style: none`, and the `outline-2` width utility resolves its style from that same
 * variable — so leaving it in place would silently cancel the very ring it sits next to.
 *
 * `disabled:opacity-40` matches Stepper. It is the affordance this prop lacked entirely: without
 * it a disabled field was pixel-identical to an enabled one.
 */
const FIELD =
  'font-mono border-ink bg-transparent w-full border px-3 py-3 text-[13px] focus:border-accent focus:outline-2 focus:outline-offset-2 focus:outline-accent disabled:opacity-40'

export function TextInput({ id, value, onChange, type = 'text', placeholder, autoComplete, error, disabled }: Props) {
  return (
    <>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-errormessage={error ? `${id}-error` : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${FIELD} ${error ? 'border-accent' : ''}`}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && (
        <p id={`${id}-error`} className="font-mono text-accent mt-1 text-[11px]">
          {error}
        </p>
      )}
    </>
  )
}
