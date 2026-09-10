import { SHOP_NAME } from '@shop/shared'
import { useTranslation } from 'react-i18next'
import { LangToggle } from '../primitives'
import { routes } from '../routes'

export interface ShopHeaderProps {
  cartCount: number
  lang: 'pt' | 'en'
  onToggleLang(): void
  onOpenCart(): void
}

/**
 * The prototype's header is six `<span onClick>`s inside two divs — no header, no nav, no link and
 * no button anywhere. Every semantic below is new, and two of them are decisions rather than
 * transcriptions:
 *
 * - `Sobre` is an `<a href>` and the bag is a `<button>`, split by what they DO. One navigates and
 *   must survive cmd-click, middle-click and a crawler; the other opens a drawer on this page and
 *   would be lying about a destination it does not have.
 * - The bag's count lives in its label, not beside it. `Sacola` with a visual `(2)` is a control
 *   whose accessible name never changes, so nothing tells a screen reader user the bag filled up.
 *
 * `est. 2026` sits at `opacity-65`, not the prototype's `.5`: ink at 50% over paper measures
 * 3.28:1, under the 4.5:1 AA floor for 12px text. 65% is 5.26:1. Same fix PR 2 made three times.
 */
export function ShopHeader({ cartCount, lang, onToggleLang, onOpenCart }: ShopHeaderProps) {
  const { t } = useTranslation()
  return (
    <header className="font-mono border-ink bg-paper px-gutter sticky top-0 z-[5] flex flex-wrap items-baseline justify-between gap-6 border-b py-5 text-xs uppercase tracking-[0.1em]">
      <div className="flex items-baseline gap-2.5">
        {/* The link wraps the name alone: with `est. 2026` inside it, the home link would announce
            itself as "My Handmade Portfolio est. 2026". The prototype makes the whole block one
            click target; a slightly smaller one is worth an accessible name that is the brand. */}
        {/* The name is `@shop/shared`'s, not this file's. It was a private constant here and
            another in `AdminHeader`, and nothing rendered-name-shaped was ever asserted, so the two
            could have drifted apart for a whole PR in silence. `est. 2026` stays here: it belongs
            to the shop's bar and to nothing else. */}
        <a href={routes.home()} className="font-display text-[22px] tracking-normal normal-case">
          {SHOP_NAME}
        </a>
        <span className="opacity-65">est. 2026</span>
      </div>
      {/* Named because it will not stay the only nav on the page: the moment a second landmark of
          the same role appears, axe's `landmark-unique` needs them told apart. */}
      <nav aria-label={t('Shop')} className="flex items-baseline gap-[clamp(14px,3vw,32px)]">
        <a href={routes.about()}>{t('About')}</a>
        <LangToggle lang={lang} onToggle={onToggleLang} />
        <button type="button" onClick={onOpenCart} className="border-ink border-b">
          {t('Bag ({{count}})', { count: cartCount })}
        </button>
      </nav>
    </header>
  )
}
