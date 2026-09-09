interface Props {
  id: string
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
  error?: string
}

/**
 * The error wiring mirrors TextInput deliberately. A message that is only painted red is invisible
 * to a screen reader: `aria-errormessage` names it, `aria-describedby` is the technique that gets
 * it announced (axe's aria-valid-attr-value rejects the former without the latter), and the `<p>`
 * carries the id both point at.
 */
export function TextArea({ id, value, onChange, rows = 4, placeholder, error }: Props) {
  return (
    <>
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-errormessage={error ? `${id}-error` : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`font-mono border-ink w-full resize-y border bg-transparent px-3 py-3 text-[13px] leading-relaxed outline-none focus:border-accent ${error ? 'border-accent' : ''}`}
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
