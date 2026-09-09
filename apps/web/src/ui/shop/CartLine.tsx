import { CART_MAX_QTY } from '@shop/shared'
import { useTranslation } from 'react-i18next'
import { Price, Stepper } from '../primitives'

export interface CartLineData {
  slug: string
  /** Already resolved for the current language by the parent. */
  name: string
  subtitle: string
  unitCents: number
  qty: number
  lineCents: number
}

export interface CartLineProps {
  line: CartLineData
  /**
   * NOT in the plan's interface, and the component cannot be built without it: `lineCents` is
   * integer BRL and every price in this app goes through `formatPrice(cents, lang)`, which takes
   * the language as an argument. The one way to get it from inside a UI component —
   * `i18n.resolvedLanguage` — is `undefined` whenever the app is in English, so it is banned
   * branch-wide. Task 3 measured that; this is the same finding arriving at a second interface.
   */
  lang: 'pt' | 'en'
  onInc(slug: string): void
  onDec(slug: string): void
}

/**
 * One line of the cart drawer. An `<li>`, so it must be rendered inside the drawer's `<ul>` — a
 * cart is a list, and its length is worth announcing.
 *
 * Decrement at qty 1 removes the line; there is no separate remove control, in the prototype or
 * here. `useCart.setQty(slug, 0)` already does exactly that.
 *
 * The thumbnail is a placeholder: `CartLineData` carries no photo, and the prototype fills the
 * slot with the product's first letter. `#e9e2d1` — the one off-palette colour in the whole
 * design, used only here — becomes `paper-2`, the token for a recessed surface and the one
 * `ImageFrame` already paints its own photo placeholder with. A fourth paper token would exist
 * only to record a 1.5% luminance accident between two colours nobody can tell apart.
 *
 * The letter keeps the prototype's `opacity-40` even though that measures 2.16:1 as rendered,
 * which is under every floor on this branch. Two reasons, and the first is not "axe let it
 * through": the glyph is pure decoration under WCAG 1.4.3 — `aria-hidden`, carrying no
 * information the name beside it does not, existing to give an empty photo slot some texture.
 * The second is that the gate would not have caught it either way, which is worth knowing:
 * axe's `color-contrast` skips single-character text as a suspected icon ligature, and it stays
 * silent here at any opacity, any font size, with or without `aria-hidden` (measured).
 */
export function CartLine({ line, lang, onInc, onDec }: CartLineProps) {
  const { t } = useTranslation()
  const atCap = line.qty >= CART_MAX_QTY
  return (
    <li className="border-ink/20 grid grid-cols-[72px_1fr_auto] items-start gap-4 border-b px-6 py-5">
      <div
        aria-hidden="true"
        className="font-display border-ink/35 bg-paper-2 flex h-[90px] w-[72px] items-center justify-center border text-[26px] opacity-40"
      >
        {line.name.charAt(0)}
      </div>
      <div className="min-w-0">
        <div className="font-display text-[21px] leading-[1.15]">{line.name}</div>
        {/* opacity-65, not the prototype's .55: 11px ink at 55% over paper is 3.83:1. */}
        <div className="font-mono mt-[5px] text-[11px] uppercase tracking-[0.1em] opacity-65">{line.subtitle}</div>
        <div className="mt-3">
          <Stepper
            qty={line.qty}
            label={t('Quantity of {{name}}', { name: line.name })}
            incrementDisabled={atCap}
            onIncrement={() => onInc(line.slug)}
            onDecrement={() => onDec(line.slug)}
          />
        </div>
        {/* `useCart` clamps to CART_MAX_QTY and says nothing, so at the cap the `+` fires, the
            state does not move, and the interface looks broken. Disabling it is half the answer —
            a control that stops responding still owes the reader a reason, and a disabled button
            cannot be focused, so it cannot carry one in an `aria-describedby` either. The cap is
            imported rather than passed in so it cannot drift from the one the cart enforces. */}
        {atCap ? (
          <p className="font-mono mt-2 text-[11px] tracking-[0.04em] opacity-65">
            {t('Maximum {{max}} per item.', { max: CART_MAX_QTY })}
          </p>
        ) : null}
      </div>
      <Price cents={line.lineCents} lang={lang} className="text-sm" />
    </li>
  )
}
