import type { ReactNode } from 'react'

/**
 * The hint's opacity MULTIPLIES with the label's: at `opacity-70` inside `opacity-75` the ink
 * lands at an effective 0.525 over paper, which is 3.54:1 — below AA for 10px text. `opacity-85`
 * (0.6375 effective, 5.05:1) is the smallest step that clears it; `opacity-80` still fails at
 * 4.47:1. Any future change to the label's own opacity has to be re-checked against this.
 */
export function FieldLabel({ htmlFor, children, hint }: { htmlFor: string; children: ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="font-mono flex flex-col gap-2 text-[10px] uppercase tracking-[0.16em] opacity-75">
      <span>
        {children}
        {hint && <span className="ml-2 normal-case tracking-normal opacity-85">{hint}</span>}
      </span>
    </label>
  )
}
