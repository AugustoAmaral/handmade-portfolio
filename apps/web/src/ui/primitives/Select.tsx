interface Props {
  id: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}

/**
 * Same focus ring as TextInput and TextArea — 2px accent, offset 2px, 5.58:1 against paper —
 * because a checkout form mixes all three and a focus indicator that changes shape between
 * controls is a worse signal than one that does not. See TextInput for the measurement and for
 * why `outline-none` must not come back.
 */
export function Select({ id, value, onChange, options }: Props) {
  return (
    <select
      id={id}
      value={value}
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
