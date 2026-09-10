import { useTranslation } from 'react-i18next'

/**
 * The hairline band of four numbers under the About blocks.
 *
 * A `<dl>` WITH THE LABEL AS THE TERM. `peças no catálogo` is what is being described and `4` is
 * its value, so the label is the `<dt>` and the number the `<dd>` — the same pairing `SpecsTable`
 * makes, and the reason `2026` is not read out as a stray number between two sentences. The design
 * wants the number ABOVE its label, which is the reverse of the only order a `<dl>` allows, so the
 * cell is `flex-col-reverse`: the markup stays honest and the paint order changes. Nothing here is
 * enforced by the gate — Task 7 measured axe's `definition-list` rule silent on an EMPTY `<dl>`,
 * and it says nothing about which half of a pair is which — so the stories assert the association
 * and the painted order directly, by geometry rather than by class name.
 *
 * `4` IS STATIC COPY, NOT DERIVED FROM THE CATALOGUE, which is the decision the plan left open.
 * Deriving it fixes one number and breaks the page around it: the About `<h1>` (Task 10) reads
 * `Uma loja de quatro peças`, spelled out as a word, and no interpolation gets a number-to-words
 * function in two languages, so a live `5` under a literal `quatro` makes the page contradict
 * itself where it currently only goes stale. The other three facts are editorial claims of exactly
 * the same kind — first letter sent, average lead time, one person — and none of them is
 * derivable, so a single live cell in a band of four also leaves the reader no way to tell which
 * numbers are current. It would cost a catalogue query on a route the plan lists as taking no
 * data, plus a plural branch on the label for the one-piece shop. Against that: one line in
 * pt.json, edited beside the `<h1>` line, by the person adding the fifth piece.
 *
 * TWO OF THE FOUR VALUES ARE INVISIBLE TO THE CONTRAST GATE. axe skips single-character text as a
 * suspected icon ligature, so `4` and `1` pass at any contrast; they are ink at full opacity on
 * paper, 15.7:1, judged on the merits rather than on the gate. The labels are checked and the
 * prototype's `opacity:.55` does not clear them — 3.82:1 at 11px against a 4.5:1 floor — so they
 * sit at 65%, 5.26:1, as every other muted mono label on this branch now does.
 *
 * NOT BUILT ON THE `Stat` PRIMITIVE PR 2 SHIPPED FOR THIS EXACT BAND — its story rendered
 * `value: '4', label: 'peças no catálogo'` and it matched this cell to the pixel, but it was a
 * pair of `<div>`s in flow order and what this band needs is a `<dt>`/`<dd>` pair in the reverse
 * one. The branch sweep deleted it rather than extend it, and the third option is the one worth
 * writing down: a self-contained `<dl>` per cell would have been valid HTML and parent-independent,
 * but it fragments one band of four facts into four one-item lists, which is a worse thing to hear
 * read out than the two duplicated class strings below are to maintain. The band's semantics are
 * needed by this page; the primitive was needed by nothing — PR 4's admin is a login, a table, a
 * form and an order list, with no facts band anywhere in it.
 *
 * The copy lives here rather than in a `facts` prop for the reasons written out in `AboutBlocks`,
 * and no `lang` prop for the same reason: nothing in this band comes from the catalogue.
 */
export function AboutFacts() {
  const { t } = useTranslation()
  return (
    <dl className="bg-ink border-ink grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-px border-y">
      <Fact value="4" label={t('pieces in the catalogue')} />
      <Fact value="2026" label={t('first letter sent')} />
      <Fact value={t('5 days')} label={t('average production time')} />
      <Fact value="1" label={t('person doing everything')} />
    </dl>
  )
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-paper flex flex-col-reverse px-[clamp(18px,3vw,32px)] py-[26px]">
      <dt className="font-mono mt-2.5 text-[11px] uppercase tracking-[0.14em] opacity-65">{label}</dt>
      <dd className="font-display text-[clamp(30px,3.4vw,42px)] leading-none">{value}</dd>
    </div>
  )
}
