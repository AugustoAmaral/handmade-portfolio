import type { ReactNode } from 'react'

/**
 * The prototype's small-caps mono type, shared by the muted eyebrow below and by `SectionRule`.
 * The two differ ONLY in opacity and in what surrounds them, and holding the recipe in one place
 * is what keeps them from drifting — the branch has already paid twice for the other answer.
 */
export const EYEBROW_TYPE = 'font-mono text-[11px] uppercase tracking-[0.18em]'

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${EYEBROW_TYPE} opacity-65 ${className}`}>{children}</div>
}
