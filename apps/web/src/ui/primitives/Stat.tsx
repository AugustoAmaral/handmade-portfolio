export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display text-[clamp(30px,3.4vw,42px)] leading-none">{value}</div>
      <div className="font-mono mt-2.5 text-[11px] uppercase tracking-[0.14em] opacity-65">{label}</div>
    </div>
  )
}
