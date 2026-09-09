import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  href?: string
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'solid' | 'outline'
  disabled?: boolean
  className?: string
}

const BASE =
  'font-mono inline-flex items-center justify-center rounded-full px-7 py-3.5 text-xs uppercase tracking-[0.1em] transition-colors'
const VARIANT = {
  solid: 'bg-ink text-paper hover:bg-accent',
  outline: 'border border-ink hover:bg-paper-3',
}

/**
 * Links are real anchors so the browser's own affordances (middle-click, open in new tab,
 * copy link) keep working; the app root upgrades same-origin clicks to client-side routing.
 */
export function PillButton({ children, href, onClick, type = 'button', variant = 'solid', disabled, className = '' }: Props) {
  const classes = `${BASE} ${VARIANT[variant]} ${disabled ? 'pointer-events-none opacity-50' : ''} ${className}`
  if (href) {
    return (
      <a href={href} className={classes} onClick={onClick}>
        {children}
      </a>
    )
  }
  return (
    <button type={type} className={classes} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}
