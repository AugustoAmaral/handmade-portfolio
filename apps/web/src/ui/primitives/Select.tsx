interface Props {
  id: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  /**
   * The id of a node describing what this field DOES — announced after the name, not folded into
   * it. `TextInput` already emits the attribute for its error message; this is the same attribute
   * for the other reason, and it is here because a `<select>` cannot be given one from outside.
   *
   * It exists for a field whose behaviour cannot be guessed from its two option words. The admin's
   * home-page field is the case: its states are `Marcada` and `Não marcada`, and what marking
   * actually does — the shop takes the FIRST ACTIVE piece carrying the mark — is a sentence, not a
   * label. Putting that sentence in the label instead was the first attempt and it wrapped to three
   * lines inside a 179px grid cell, dropping the control 30px below the five beside it.
   */
  describedBy?: string
}

/**
 * Same focus ring as TextInput and TextArea — 2px accent, offset 2px, 5.58:1 against paper —
 * because a checkout form mixes all three and a focus indicator that changes shape between
 * controls is a worse signal than one that does not. See TextInput for the measurement and for
 * why `outline-none` must not come back.
 */
export function Select({ id, value, onChange, options, describedBy }: Props) {
  return (
    <select
      id={id}
      value={value}
      aria-describedby={describedBy}
      className="font-mono border-ink w-full border bg-transparent px-3 py-3 text-[13px] focus:border-accent focus:outline-2 focus:outline-offset-2 focus:outline-accent"
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
