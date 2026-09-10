import { SHOP_NAME } from '@shop/shared'
import { useTranslation } from 'react-i18next'
import { routes } from '../routes'

/** The two screens the bar navigates between. */
export type AdminSection = 'products' | 'orders'

export interface AdminHeaderProps {
  /**
   * The section showing right now, or `undefined` on a screen that is neither — the login, which
   * the shell renders in place rather than redirecting to.
   */
  current?: AdminSection
  /**
   * Whether there is a session. It gates the two section links AND the sign-out control together
   * because neither means anything without one: the links would land back on the login they were
   * clicked from, and there is no session to end.
   */
  signedIn: boolean
  onSignOut(): void
}

/**
 * The admin's dark bar: paper on ink, which is the only surface on this project that runs that way
 * round, and which inverts every contrast number the branch has measured on paper.
 *
 * WHAT DID NOT CHANGE, AND THAT IS THE POINT. `Painel` stays at the prototype's `opacity-50` and
 * the two leave controls stay at `opacity-60`. The branch's standing rule — muted text below
 * `opacity-65` does not clear AA — is a PAPER rule: ink at 50% over paper is 3.30:1, but paper at
 * 50% over ink is 4.76:1 and paper at 60% is 6.30:1. Both pass. Raising them here would flatten the
 * bar's hierarchy to satisfy arithmetic that does not apply. `AdminHeader.stories.tsx` measures the
 * composited colours in the browser rather than trusting either number.
 *
 * WHAT DID CHANGE. The nav underline is `border-paper/40`, not the prototype's
 * `rgba(244,240,230,.35)`: 35% composites to 2.98:1 against ink, two hundredths under the 3:1 that
 * WCAG 2.2 SC 1.4.11 asks of a graphical object, and 40% measures 3.51:1. No axe rule covers
 * non-text contrast, so the story does.
 *
 * AND THE FOCUS RING IS PAPER, NOT ACCENT. `TextInput`'s 2px accent ring is 5.58:1 on paper and
 * **2.81:1 on ink** — under the same 3:1 floor, for the same reason in the other direction. Paper
 * on ink is 15.69:1, and at the 60% the two leave controls carry it is still 6.30:1.
 */
const BAR =
  'font-mono bg-ink text-paper px-gutter-admin sticky top-0 z-[5] flex flex-wrap items-center justify-between gap-5 py-3.5 text-[11px] uppercase tracking-[0.14em]'

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper'

/**
 * The current section is marked twice over, and neither mark is a colour. `aria-current="page"`
 * carries it to a screen reader, and the underline doubles in width — a difference in thickness
 * rather than in hue or lightness, so it survives the reader who cannot tell 100% paper from 40%.
 *
 * The two are spelled out as whole class strings instead of a base plus an override. `border-b` and
 * `border-b-2` have equal specificity, so which one wins is decided by the order Tailwind happened
 * to emit them in, not by the order they appear in the attribute.
 */
const NAV_LINK = `border-b border-paper/40 ${FOCUS}`
const NAV_LINK_CURRENT = `border-b-2 border-paper ${FOCUS}`

/** `Ver a loja` and `Sair` both leave: same weight, and the design's own `opacity-60`. */
const LEAVE = `opacity-60 ${FOCUS}`

export function AdminHeader({ current, signedIn, onSignOut }: AdminHeaderProps) {
  const { t } = useTranslation()
  return (
    <header className={BAR}>
      <div className="flex flex-wrap items-center gap-5">
        {/* Not a link, unlike the shop's brand. The admin is unlinked from the shop and the shop is
            one click away under `Ver a loja`; a brand that navigated somewhere would be a second,
            unlabelled door to the same place. */}
        <span className="font-display text-[19px] tracking-normal normal-case">{SHOP_NAME}</span>
        <span className="opacity-50">{t('Panel')}</span>
      </div>
      <div className="flex items-center gap-[clamp(14px,3vw,26px)]">
        {signedIn && (
          // Named so a second unnamed navigation landmark — the shop's, if the two bars ever share
          // a document — cannot collide with it.
          <nav aria-label={t('Panel')} className="flex items-center gap-[clamp(14px,3vw,26px)]">
            <a
              href={routes.adminProducts()}
              aria-current={current === 'products' ? 'page' : undefined}
              className={current === 'products' ? NAV_LINK_CURRENT : NAV_LINK}
            >
              {t('Products')}
            </a>
            <a
              href={routes.adminOrders()}
              aria-current={current === 'orders' ? 'page' : undefined}
              className={current === 'orders' ? NAV_LINK_CURRENT : NAV_LINK}
            >
              {t('Orders')}
            </a>
          </nav>
        )}
        <a href={routes.home()} className={LEAVE}>
          {/* The arrow says the link leaves the panel and says nothing a reader needs spelled out,
              so it stays out of the accessible name. */}
          {t('View the shop')} <span aria-hidden="true">↗</span>
        </a>
        {/* The design draws no way out of a session, because it draws no session. A screen that can
            be signed into and not out of is not finishable, and the bar is the only surface every
            admin screen shares. A button and not a link: nothing is navigated, and the URL the
            reader is on is the one they should come back to after signing in again. */}
        {signedIn && (
          <button type="button" onClick={onSignOut} className={LEAVE}>
            {t('Sign out')}
          </button>
        )}
      </div>
    </header>
  )
}
