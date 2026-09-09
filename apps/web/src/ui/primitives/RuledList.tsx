import type { ReactNode } from 'react'

/** The prototype's hairline list: a 1px ink grid gap showing through between paper rows. */
export function RuledList({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-ink border-ink flex flex-col gap-px border ${className}`}>{children}</div>
}

export function RuledRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-paper px-4 py-3.5 ${className}`}>{children}</div>
}
