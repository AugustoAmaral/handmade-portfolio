import { useTranslation } from 'react-i18next'
import { PillButton } from '../primitives'
import { routes } from '../routes'

export interface AboutClosingProps {
  /** Configuration, not copy: `routes.mailto` needs an address and the shop's address is not a
   *  translatable string. The same prop `ClosingBlock` takes, for the same reason, and the same
   *  subject key, so the two mail links on the site are one decision rather than two. */
  contactEmail: string
}

/**
 * The last band of the About page: the pitch that the shop is the portfolio, and the two ways out.
 *
 * NOT A VARIANT OF `ClosingBlock`, which says almost the same thing at the bottom of the home page.
 * The extract warns that the two heroes differ in five measured ways and must not share an
 * implementation blindly, and these two bands differ in five of their own: the track floor is
 * 280px against 260px, the band bottoms out at `88px` of padding against `80px`, the statement runs
 * to `44px` against `42px` at a line height of `1.1` against `1.12`, the whole band is centred in a
 * `1240px` measure that the home band does not have, and the right-hand column is two paragraphs
 * over a row of controls rather than the home band's single paragraph. Sharing them means a
 * `variant` prop that toggles five numbers.
 *
 * THE LINKS ARE REAL, WHICH THE DESIGN IS NOT. `Falar comigo` is an `<a href="#">` in the
 * prototype and `Ver o catálogo` is a `<span onClick>`, so one goes nowhere and the other is not a
 * link at all — neither can be middle-clicked, copied or reached by Tab. `Falar comigo` becomes the same
 * `mailto:` `ClosingBlock` builds, subject included, so a message from either page lands
 * identifiable and identical in an inbox; `Ver o catálogo` becomes an `<a href>` on `routes.home()`
 * that the app root upgrades to client-side navigation. Neither is a callback: nothing happens
 * before or instead of navigating.
 *
 * THE STATEMENT IS AN `<h2>`, where the prototype has a large `<div>`. It is what the paragraphs
 * beside it are about, and on the finished page it is the fourth of four headings under the About
 * `<h1>` — the level that keeps `heading-order` quiet is the same level that makes the outline
 * true, so there is no trade here.
 *
 * NO `lang` PROP: every string is a `t()` key and nothing comes from the catalogue. Checked, not
 * assumed — see the note in `AboutBlocks`.
 */
export function AboutClosing({ contactEmail }: AboutClosingProps) {
  const { t } = useTranslation()
  return (
    <section className="px-gutter mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-start gap-[clamp(28px,5vw,64px)] py-[clamp(40px,7vw,88px)]">
      <h2 className="font-display text-[clamp(28px,3.4vw,44px)] leading-[1.1] text-balance">
        {t('If you got here through the code, and not through the letter.')}
      </h2>
      <div className="flex max-w-[46ch] flex-col gap-5">
        <p className="text-[17px] leading-[1.6] text-pretty opacity-80">
          {t(
            'This site is the portfolio: the storefront, the product page, the bag, the checkout and the payment integration were all built by me, from scratch. The name is a joke about that — a handmade portfolio that happens to sell handmade things.',
          )}
        </p>
        <p className="text-[17px] leading-[1.6] text-pretty opacity-80">
          {t('I am up for conversations about product, interface and web systems. I also take letter commissions.')}
        </p>
        <div className="flex flex-wrap gap-[14px]">
          <PillButton href={routes.mailto(contactEmail, t('Message from the site'))}>{t('Talk to me')}</PillButton>
          <PillButton href={routes.home()} variant="outline">
            {t('See the catalogue')}
          </PillButton>
        </div>
      </div>
    </section>
  )
}
