import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { PillButton, Price } from '../primitives'
import { routes } from '../routes'
import { CartLine, type CartLineData } from './CartLine'

export interface CartDrawerProps {
  open: boolean
  lines: CartLineData[]
  /** See `CartLineProps.lang`: the three totals below are integer cents and need formatting. */
  lang: 'pt' | 'en'
  itemsCents: number
  shippingCents: number | null
  totalCents: number
  onInc(slug: string): void
  onDec(slug: string): void
  onClose(): void
}

const TITLE_ID = 'cart-drawer-title'

/**
 * `muted` is the prototype's `opacity:.6` on the Subtotal and Frete labels, raised to 65: ink at
 * 60% over paper measures 4.48:1 and the floor for 13px text is 4.5:1. The Total row keeps both
 * labels at full strength, which is the only thing that separates it from the two above it.
 */
function TotalsRow({
  label,
  muted = false,
  className = '',
  children,
}: {
  label: string
  muted?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`flex justify-between ${className}`}>
      <dt className={muted ? 'opacity-65' : ''}>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/**
 * The cart drawer.
 *
 * NOT IMPLEMENTED HERE, ON PURPOSE: focus trapping, restoring focus to the bag button on close,
 * and Escape-to-close. All three need an effect hook and a node reference, both of which
 * `test/ui-boundaries.test.ts` rejects anywhere under `src/ui` — and it rejects them by scanning
 * the file as text, so this paragraph cannot even name them. `ShopShellContainer` (Task 11) owns
 * all three, and until it does the `aria-modal="true"` below is a promise the markup alone cannot
 * keep. It is set anyway, because the alternative is a dialog that never claims to be modal.
 *
 * The empty drawer shows the message and NOTHING else — no totals, no call to action. The
 * prototype keeps both: a live "Ir para o pagamento" over an empty bag, which opens a checkout
 * with no items in it, priced at R$ 0,00. Hiding beats disabling here because a disabled CTA is
 * still an answer to a question nobody asked; the totals go with it because "Total R$ 0,00" is
 * arithmetic about nothing. The bag has one fact in this state and it is on screen.
 *
 * The scrim closes the drawer on click and is `aria-hidden`: it is decoration with a mouse
 * convenience attached, and the keyboard path is the close button (plus the Escape handler Task 11
 * adds). It carries no role and no tabindex, so it is not a control that AT can reach and fail to
 * use.
 */
export function CartDrawer({
  open,
  lines,
  lang,
  itemsCents,
  shippingCents,
  totalCents,
  onInc,
  onDec,
  onClose,
}: CartDrawerProps) {
  const { t } = useTranslation()
  if (!open) return null
  return (
    <div className="fixed inset-0 z-20">
      <div aria-hidden="true" onClick={onClose} className="bg-ink/42 absolute inset-0" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        className="border-ink bg-paper absolute inset-y-0 right-0 flex w-[min(460px,100%)] flex-col border-l shadow-[-24px_0_60px_rgba(26,23,19,0.18)]"
      >
        <div className="font-mono border-ink flex items-center justify-between border-b px-6 py-5 text-[11px] uppercase tracking-[0.18em]">
          <h2 id={TITLE_ID}>{t('Your bag')}</h2>
          <button type="button" onClick={onClose} aria-label={t('Close the bag')} className="text-[18px] tracking-normal">
            {/* Hidden from AT so the button is named by its label and nothing else: a glyph read
                aloud is noise, and a visible "✕" that is not part of the accessible name is what
                trips `label-content-name-mismatch` on any icon axe does consider readable. */}
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        {lines.length === 0 ? (
          <p className="font-display px-6 py-10 text-[26px] leading-[1.2] opacity-60">{t('Your bag is empty.')}</p>
        ) : (
          <>
            <ul className="flex flex-1 flex-col overflow-y-auto">
              {lines.map((line) => (
                <CartLine key={line.slug} line={line} lang={lang} onInc={onInc} onDec={onDec} />
              ))}
            </ul>
            <div className="border-ink flex flex-col gap-[18px] border-t px-6 py-5">
              <dl className="font-mono flex flex-col gap-[14px] text-[13px]">
                <TotalsRow label={t('Subtotal')} muted>
                  <Price cents={itemsCents} lang={lang} />
                </TotalsRow>
                <TotalsRow label={t('Shipping')} muted>
                  {shippingCents === null ? (
                    <>
                      {/* The design's placeholder is a bare em dash, which is silence to a screen
                          reader — the row would announce "Frete" and stop. The dash stays for the
                          eye; the sentence behind it is for everyone else. */}
                      <span aria-hidden="true">—</span>
                      <span className="sr-only">{t('Calculated at checkout')}</span>
                    </>
                  ) : (
                    <Price cents={shippingCents} lang={lang} />
                  )}
                </TotalsRow>
                <TotalsRow label={t('Total')} className="border-ink/25 border-t pt-[14px] text-base">
                  <Price cents={totalCents} lang={lang} />
                </TotalsRow>
              </dl>
              <PillButton href={routes.checkout()} size="block">
                {t('Go to payment')}
              </PillButton>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
