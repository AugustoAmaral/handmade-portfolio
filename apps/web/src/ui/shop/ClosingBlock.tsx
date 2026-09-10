import { useTranslation } from 'react-i18next'
import { routes } from '../routes'

export interface ClosingBlockProps {
  /** Comes from the container, not from a constant here: `routes.mailto` needs an address, and the
   *  shop's address is configuration, not copy. It takes no `lang` because it prints no price and
   *  no catalogue data — the two `t()` calls below are already in the reader's language. */
  contactEmail: string
}

/**
 * The last band of the home page: the pitch that the shop is the portfolio.
 *
 * THE LINK IS A REAL `mailto:`. The design has `href="#"` here and again on the About page, and no
 * address anywhere in the file; the spec supplies one, and `routes.mailto` is where the format
 * lives. It carries a subject so the mail lands identifiable in an inbox, and no body — a
 * pre-written first line from a stranger's own mouth is worse than an empty message.
 *
 * `mailto:` is also the one href the app must NOT take over, which is already handled: the shared
 * rule in `app/anchors.ts` leaves any non-HTTP scheme to the browser, so this link opens a mail
 * client in the app and in Storybook alike.
 *
 * THE SENTENCE IS THREE KEYS because a link sits inside it. Splitting a sentence for translation is
 * normally a mistake — word order moves and the fragments stop fitting together — and it is done
 * here with the cut placed where both languages agree: a full sentence, a clause that ends on a
 * comma, and the link's own words, which are the last thing in the sentence in English and in
 * Portuguese. The alternative is `<Trans>` with numbered placeholders inside the key, which nothing
 * else on this branch uses and which `copy.test.ts` cannot scan, so a missing translation would go
 * out as English with no failing test.
 *
 * The statement is an `<h2>`: it is what the paragraph beside it is about, and the home page
 * otherwise ends on an unlabelled band. It reads as one of three headings on the page — the hero's
 * `<h1>`, the catalogue's `<h2>`, this one — which is also the shape that makes axe's `heading-order`
 * capable of firing at all.
 */
export function ClosingBlock({ contactEmail }: ClosingBlockProps) {
  const { t } = useTranslation()
  return (
    <section className="px-gutter grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] items-start gap-[clamp(28px,5vw,64px)] py-[clamp(40px,7vw,80px)]">
      <h2 className="font-display text-[clamp(28px,3.4vw,42px)] leading-[1.12] text-balance">
        {t('Made by one person, from the drawing to the checkout.')}
      </h2>
      <p className="max-w-[46ch] text-[17px] leading-[1.6] text-pretty opacity-80">
        {`${t('I write, draw, pack and post. I also wrote the cart, the payment integration and this page.')} ${t('If what you need is the second part,')} `}
        <a href={routes.mailto(contactEmail, t('Message from the site'))} className="border-ink border-b">
          {t('send me a message')}
        </a>
        {'.'}
      </p>
    </section>
  )
}
