import { useTranslation } from 'react-i18next'

interface Props {
  qty: number
  onDecrement: () => void
  onIncrement: () => void
  disabled?: boolean
}

export function Stepper({ qty, onDecrement, onIncrement, disabled }: Props) {
  const { t } = useTranslation()
  return (
    <div className="font-mono border-ink flex w-max items-center border text-[13px]">
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
        disabled={disabled}
        className="px-3 py-1.5 hover:bg-paper-3 disabled:opacity-40"
        onClick={onIncrement}
      >
        +
      </button>
    </div>
  )
}
