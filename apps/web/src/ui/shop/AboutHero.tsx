import { useTranslation } from 'react-i18next'
import { Eyebrow, ImageFrame } from '../primitives'

export interface AboutHeroProps {
  /**
   * spec:219 gives the About page a static portrait (`public/about-portrait.jpg`) that does not
   * exist yet, and a paper placeholder until it does. That is two states, not one, so it is a prop
   * rather than a constant here — and the alt travels WITH the url because whoever supplies the
   * photograph is the only person who can describe it. A url with no alt would ship the largest
   * element on the page undescribed, which is the exact trade `Hero` reasons about for the
   * catalogue photo.
   */
  portrait?: { url: string; alt: string }
}

/**
 * The About page's opening band. The file map forgot it — `Hero` is spoken for by the home page —
 * and the extract is emphatic that the two must not share an implementation, so this is the second
 * hero rather than a `variant` prop on the first.
 *
 * THE FIVE MEASURED DIFFERENCES from `Hero`, kept as the extract records them: the track floor is
 * `300px` against `320px`; the copy cell is `justify-center` at `gap-[22px]` against
 * `justify-between gap-10`; the `<h1>` is `clamp(38px,6vw,74px)` at `leading-none` against
 * `clamp(44px,7vw,86px)` at `0.98`; the photo cell floors at `min(56vh,460px)` against
 * `min(66vh,540px)`; and there is no card over the photo. A shared component behind a flag would
 * be five numbers toggled by one boolean, which is a component with two layouts and one name.
 *
 * THE DANGLING EDGE IS FIXED THE SAME WAY `Hero` FIXES IT, and it has to be: the prototype puts
 * `border-right` on this cell too, unconditionally, over an `auto-fit` grid that collapses to one
 * column on a narrow screen and leaves the rule attached to nothing. The hairline grid — `gap-px`
 * over `bg-ink`, each cell painting `bg-paper` — renders an identical 1px rule between two columns
 * and turns it into a rule between two stacked cells at one column, with no media query to keep in
 * sync. Two heroes that fixed this differently would be worse than two heroes.
 *
 * THE EYEBROW REUSES THE HEADER'S `About` KEY. It is the same word about the same page, and a
 * second key holding `Sobre` is a second place for it to be retranslated. `Eyebrow` also carries
 * the contrast fix: the prototype's `opacity:.6` is 4.47:1 on paper against a 4.5:1 floor at 11px,
 * and the primitive sits at 65%, which is 5.26:1.
 *
 * NO `lang` PROP, checked rather than assumed. Every string is a `t()` key the provider resolves,
 * the portrait's alt arrives already written, and no price is formatted — so there is no `{pt,en}`
 * pair to pick from and no hole of the kind Task 5 found in two interfaces at once.
 *
 * THE SENTENCE IS THREE KEYS because the middle clause is italic, the same cut `Hero` makes. The
 * comma sits at the END of the first fragment here and at the START of the third one there — that
 * is where each language puts it, and it is the detail that moves silently when someone re-cuts
 * the sentence.
 */
export function AboutHero({ portrait }: AboutHeroProps) {
  const { t } = useTranslation()
  return (
    <section className="bg-ink border-ink grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-px border-b">
      <div className="bg-paper flex flex-col justify-center gap-[22px] p-[clamp(32px,6vw,72px)]">
        <Eyebrow>{t('About')}</Eyebrow>
        <h1 className="font-display text-[clamp(38px,6vw,74px)] leading-none text-balance">
          {t('A shop of four pieces,')} <em>{t('written by hand')}</em> {t('in both senses.')}
        </h1>
        <p className="max-w-[44ch] text-[clamp(17px,1.6vw,20px)] leading-[1.55] text-pretty opacity-80">
          {t(
            'I am Augusto. A developer by day, and in my spare time someone who writes letters, draws in India ink and embroiders bookmarks. This shop exists because I wanted to build a shop — and it felt more honest to sell things I actually make.',
          )}
        </p>
      </div>
      <div className="bg-paper relative min-h-[min(56vh,460px)]">
        {/* The prototype's `placeholder="Foto sua ou da bancada"` is an instruction to the person
            filling the design in, not alt text — `ImageFrame`'s own paper placeholder is the house
            answer, and it is what the page shows until the photograph exists. */}
        <ImageFrame ratio="fill" src={portrait?.url} alt={portrait?.alt ?? ''} />
      </div>
    </section>
  )
}
