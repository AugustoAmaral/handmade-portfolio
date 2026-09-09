import { useTranslation } from 'react-i18next'
import { Eyebrow } from '../primitives'

/**
 * The About page's three editorial blocks: how it works, materials, returns.
 *
 * THE COPY LIVES HERE, NOT IN PROPS, and the plan asked for the opposite — `AboutBlocksProps
 * { blocks }` with the strings resolved one level up. Three measured things decide it the other
 * way. `test/copy.test.ts` scans `src/ui` for literal `t('…')` call sites and fails on any pt.json
 * key that no call site accounts for, so keys resolved in a container under `src/app` are keys
 * nothing accounts for — red on the commit that adds them, not on some later one. That same
 * scanner is blind to a key assembled at runtime and pins the number of dynamic call sites at
 * exactly one, so these cannot be a `BLOCKS.map(t)` table either: wherever the copy lives, it has
 * to be spelled out as nine literals. And a story that passes the Portuguese in as args and then
 * asserts it back is asserting its own arguments — with the copy inside, the story asserts that
 * pt.json is wired up, which is the only thing here that can actually break.
 *
 * There is also nothing to vary. These are three fixed editorial blocks, not a list the shop
 * grows; a `blocks` prop would exist only so a story could render a state the app never reaches.
 *
 * NO `lang` PROP, checked rather than assumed. `lang` is a prop on the other shop components
 * because `PublicProduct` carries `{ pt, en }` pairs and `i18n.resolvedLanguage` is `undefined`
 * whenever the app is in English, so a component picking the language off the instance renders
 * blanks. Nothing in this band comes from the catalogue — every string is a `t()` key resolved by
 * the provider's instance — so there is no second language to choose between and no hole to plug.
 *
 * THE TAG IS AN `Eyebrow`, NOT A HEADING. It labels the block for the eye, but the page's outline
 * is the three titles: making `01 · Como funciona` a heading would put six headings on the About
 * page where three belong, and this band is the first place on the branch with enough headings for
 * axe's `heading-order` to fire at all. Reusing the primitive normalises the tracking from the
 * prototype's `.16em` to its `.18em` — 0.02em at 11px, about a fifth of a pixel per character —
 * and carries the contrast fix already: the prototype's `opacity:.5` is 3.30:1 on paper against a
 * 4.5:1 floor, and `Eyebrow` sits at 65%, which is 5.26:1. A local copy of the primitive with the
 * exact tracking was the alternative, and it is how three near-identical mono labels start
 * drifting apart.
 */
export function AboutBlocks() {
  const { t } = useTranslation()
  return (
    <section className="px-gutter mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-[clamp(28px,4vw,56px)] py-[clamp(36px,6vw,80px)]">
      <Block
        tag={t('01 · How it works')}
        title={t('You order, I make it, the post office delivers.')}
        body={t(
          'Nothing here is made in batches. After the payment I start the piece, and I send the tracking code by e-mail when I post it. The lead time for each item is on its own page.',
        )}
      />
      <Block
        tag={t('02 · Materials')}
        title={t('Cotton paper, India ink, graphite and thread.')}
        body={t(
          'I use 180gsm cotton paper, black India ink, 2H to 6B graphite pencils and cotton thread. That is the whole list. When ceramics join the catalogue, this list changes.',
        )}
      />
      <Block
        tag={t('03 · Returns')}
        title={t('If it arrives crooked, I make it again.')}
        body={t(
          'A piece damaged in transit or not what we agreed on: write to me within seven days and I will remake it or refund you. Custom orders go through a preview before they are finished.',
        )}
      />
    </section>
  )
}

function Block({ tag, title, body }: { tag: string; title: string; body: string }) {
  return (
    <div>
      <Eyebrow className="border-ink mb-4 border-b pb-3">{tag}</Eyebrow>
      <h2 className="font-display mb-3 text-[clamp(24px,2.6vw,32px)] leading-[1.12]">{title}</h2>
      <p className="text-[17px] leading-[1.6] text-pretty opacity-80">{body}</p>
    </div>
  )
}
