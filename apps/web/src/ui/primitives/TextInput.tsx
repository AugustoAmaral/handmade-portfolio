// `aria-errormessage` alone is not enough: axe's aria-valid-attr-value requires the referenced
// message to ALSO use an announcement technique, so `aria-describedby` points at the same node.
// Without it the error is painted but never spoken.
interface Props {
  id: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'email' | 'tel' | 'number'
  placeholder?: string
  error?: string
  disabled?: boolean
}

const FIELD =
  'font-mono border-ink bg-transparent w-full border px-3 py-3 text-[13px] outline-none focus:border-accent'

export function TextInput({ id, value, onChange, type = 'text', placeholder, error, disabled }: Props) {
  return (
    <>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
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
