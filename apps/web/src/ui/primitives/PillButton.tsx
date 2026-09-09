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
 *
 * The `disabled` guard comes BEFORE the `href` check, and that order is the whole point. A
 * disabled anchor is not a thing: `pointer-events-none` stops the mouse and nothing else, so Tab
 * still reaches it and Enter still navigates. Dropping to a real `<button disabled>` is what makes
 * it unreachable and unactivatable, and it announces itself as disabled with no custom ARIA to get
 * wrong. A control that cannot be activated must not claim to be a link.
 */
export function PillButton({ children, href, onClick, type = 'button', variant = 'solid', disabled, className = '' }: Props) {
  const classes = `${BASE} ${VARIANT[variant]} ${disabled ? 'pointer-events-none opacity-50' : ''} ${className}`
  if (href && !disabled) {
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
