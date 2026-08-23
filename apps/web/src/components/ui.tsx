import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export function Button({ variant = 'default', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'ghost' | 'destructive' }) {
  const variants = {
    default: 'bg-stone-900 text-stone-50 hover:bg-stone-700',
    outline: 'border border-stone-300 hover:bg-stone-100',
    ghost: 'hover:bg-stone-100',
    destructive: 'bg-red-600 text-white hover:bg-red-500',
  }
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  )
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 ${className}`}
      {...props}
    />
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-stone-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>
}

export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium ${className}`}>{children}</span>
}

export function Field({ label, htmlFor, children, error }: { label: string; htmlFor: string; children: ReactNode; error?: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-stone-700">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
