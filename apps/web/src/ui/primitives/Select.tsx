interface Props {
  id: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}

export function Select({ id, value, onChange, options }: Props) {
  return (
    <select
      id={id}
      value={value}
      className="font-mono border-ink w-full border bg-transparent px-3 py-3 text-[13px] outline-none focus:border-accent"
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
