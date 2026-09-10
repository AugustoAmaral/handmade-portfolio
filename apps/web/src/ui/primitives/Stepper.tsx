import { useTranslation } from 'react-i18next'

interface Props {
  qty: number
  onDecrement: () => void
  onIncrement: () => void
  disabled?: boolean
  /**
   * Accessible name of the control as a whole. A cart drawer renders one stepper per line and
   * they are otherwise indistinguishable: "Aumentar quantidade" three times over tells a screen
   * reader user which button they are on and nothing about which product it belongs to.
   */
  label?: string
  /**
   * Increment only. Separate from `disabled` because the two mean different things: `disabled`
   * is "this control is inert", `incrementDisabled` is "this line is at the per-item cap" — the
   * decrement must stay live there, since it is the only way back down (and, at qty 1, the only
   * way to remove the line).
   */
  incrementDisabled?: boolean
}

export function Stepper({ qty, onDecrement, onIncrement, disabled, label, incrementDisabled }: Props) {
  const { t } = useTranslation()
  return (
    <div
      role="group"
      aria-label={label ?? t('Quantity')}
      className="font-mono border-ink flex w-max items-center border text-[13px]"
    >
      <button
        type="button"
        aria-label={t('Decrease quantity')}
        disabled={disabled}
        className="px-3 py-1.5 hover:bg-paper-3 disabled:opacity-40"
        onClick={onDecrement}
      >
        −
      </button>
      <span className="border-ink min-w-8 border-x px-2 py-1.5 text-center">{qty}</span>
      <button
        type="button"
        aria-label={t('Increase quantity')}
        disabled={disabled || incrementDisabled}
        className="px-3 py-1.5 hover:bg-paper-3 disabled:opacity-40"
        onClick={onIncrement}
      >
        +
      </button>
    </div>
  )
}
