import { type FieldErrors, type PublicProduct, formatPrice } from '@shop/shared'
import { useTranslation } from 'react-i18next'
import { FieldLabel, Select, TextInput } from '../primitives'
import { useFieldError } from '../shop/CheckoutSection'

/**
 * What the six identifier fields hold WHILE THEY ARE BEING TYPED, which is not what the API
 * stores. `price` and `stock` are the raw text in the box, because a controlled field that round
 * trips through a number cannot hold `19,` long enough for the `9` after it to arrive — the
 * separator is erased on the keystroke that produced it. The conversions below are the edge, and
 * they are exported so the container converts with exactly the same arithmetic the stories pin.
 */
export interface ProductBasicsValues {
  /** The URL slug. `productInputSchema` requires `/^[a-z0-9-]+$/`, so an empty one is rejected. */
  slug: string
  /** Reais as typed: `45`, `45,90`, `45.90`. Converted by `centsFromReais`. */
  price: string
  /** A count as typed. Kept while `unlimitedStock` is on, so unticking the box gives it back. */
  stock: string
  /** The box that produces `stock: null` — no limit — which is a different fact from a count of 0. */
  unlimitedStock: boolean
  type: 'physical' | 'digital'
  /**
   * The piece the shop's home page leads with. A SINGLE-WINNER FLAG WITH NO UNIQUENESS CONSTRAINT:
   * `productInputSchema` is `z.boolean().default(false)` and neither the Mongoose model nor
   * `routes/admin/products.ts` holds it to one document, so this is the answer for ONE product and
   * never the answer for the catalogue. The shop resolves the tie itself (spec:58).
   */
  featured: boolean
  active: boolean
}

export interface ProductBasicsFieldsProps {
  values: ProductBasicsValues
  /** Only the price floor is formatted from cents, and `formatPrice` needs the language for it. */
  lang: 'pt' | 'en'
  /** Keyed as `productInputSchema` names the fields: `slug`, `priceCents`, `stock`. */
  errors: FieldErrors
  /** The whole object, not a field/value pair: six fields of four different types would need a
   * generic the story's mocks cannot express, and the container's job is a single assignment. */
  onChange(values: ProductBasicsValues): void
}

/**
 * `productInputSchema` is `priceCents: z.number().int().min(100)`, and this is the second copy of
 * that 100. It is a CHECKED copy: `ProductBasicsFields.stories.tsx` parses `MIN_PRICE_CENTS` and
 * `MIN_PRICE_CENTS - 1` through the schema itself, so moving the floor upstream reddens a story
 * here instead of leaving the hint quietly lying about the minimum. The alternative — exporting
 * the number from `@shop/shared` beside the schema — is the better home and is a change to a
 * package this task may not touch.
 */
export const MIN_PRICE_CENTS = 100

/**
 * One amount, one optional separator, at most two decimals. Both separators are accepted because
 * the panel is Portuguese and `,` is what the person typing means by a decimal point, while `.`
 * is what a numeric keypad offers and what a value copied out of any English tool carries.
 *
 * It deliberately does NOT accept a group separator. `R$ 1.200,00` — what `formatPrice` prints in
 * pt-BR — has two separators and is rejected rather than guessed at, and `1.200` alone is refused
 * for the same reason: in pt-BR it reads as one thousand two hundred and in en-US as one and two
 * tenths, and a field that silently picks one of those is off by a factor of a thousand.
 */
const AMOUNT = /^(\d+)(?:[.,](\d{0,2}))?$/
const COUNT = /^\d+$/

/**
 * THE ONE PLACE ON THIS BRANCH WHERE ARITHMETIC COSTS MONEY, and it is done on the DIGITS rather
 * than on a float. `19.99 * 100` is `1998.9999999999998`; `Math.floor` of that is 1998 — a
 * centavo lost on every price ending in 99 — and the unrounded value is not an integer, so
 * `z.number().int()` rejects the request outright. `Math.round` happens to be right for 19.99 and
 * is not right in general: `8.165 * 100` is `816.4999999999999`, which rounds to 816 where the
 * decimal answer is 817. Reading the two digit groups and combining them as integers has no such
 * failure, and it is also the only version that can read `19,99` at all.
 *
 * The fraction is padded on the RIGHT: `19,9` is nineteen reais and ninety centavos, not nine.
 *
 * `NaN` for anything unparseable, and that is the useful answer rather than a defensive one:
 * `productInputSchema` rejects it as `priceCents: Expected number, received nan`, keyed at the
 * field, so an unreadable price lands on the price field instead of vanishing into a zero.
 */
export function centsFromReais(text: string): number {
  const match = AMOUNT.exec(text.trim())
  if (!match) return Number.NaN
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  return Number.isSafeInteger(cents) ? cents : Number.NaN
}

/**
 * The other direction, for seeding the field from a product that already exists. Always a comma
 * and never a group separator, in both languages: the panel is Portuguese, and the output has to
 * be something `centsFromReais` reads back unchanged, which `R$ 1.200,00` is not.
 */
export function reaisFromCents(cents: number): string {
  return `${Math.trunc(cents / 100)},${String(Math.abs(cents) % 100).padStart(2, '0')}`
}

/**
 * `NaN` rather than 0 for an empty box, for the same reason the price does it: `Number('')` is 0,
 * and 0 means SOLD OUT. A blank stock field that quietly published a piece as unavailable would
 * look exactly like a piece that had sold.
 */
export function countFromDigits(text: string): number {
  const trimmed = text.trim()
  if (!COUNT.test(trimmed)) return Number.NaN
  const count = Number(trimmed)
  return Number.isSafeInteger(count) ? count : Number.NaN
}

/**
 * The `stock` the API is sent. `null` is NO LIMIT and is a state a number input cannot express;
 * `0` is sold out. They are the same shape in the schema (`z.number().int().min(0).nullable()`)
 * and opposite facts in the shop, which is why the box exists.
 *
 * `stock` is `nullable()` and NOT `optional()`, so this always returns something and the container
 * always sends it. Omitting the key is `stock: Required`, not an unchanged stock level.
 */
export function stockFrom(values: ProductBasicsValues): number | null {
  return values.unlimitedStock ? null : countFromDigits(values.stock)
}

/** Seeds the form from a product the panel loaded. The container's other direction is `stockFrom`. */
export function basicsFromProduct(product: PublicProduct): ProductBasicsValues {
  return {
    slug: product.slug,
    price: reaisFromCents(product.priceCents),
    stock: product.stock === null ? '' : String(product.stock),
    unlimitedStock: product.stock === null,
    type: product.type,
    featured: product.featured,
    active: product.active,
  }
}

/**
 * A new draft. `active: false` is a decision and not an omission: a piece with no photos and no
 * English copy yet would otherwise appear in the shop the moment it is saved, and the panel's own
 * status chip is one click away from publishing it on purpose.
 */
export const EMPTY_BASICS: ProductBasicsValues = {
  slug: '',
  price: '',
  stock: '',
  unlimitedStock: false,
  type: 'physical',
  featured: false,
  active: false,
}

const SLUG_ID = 'product-slug'
const PRICE_ID = 'product-price'
const STOCK_ID = 'product-stock'
const TYPE_ID = 'product-type'
const ACTIVE_ID = 'product-active'
const FEATURED_ID = 'product-featured'
const FEATURED_NOTE_ID = 'product-featured-note'

/**
 * The product form's identifier row: the six fields that are the same in both languages.
 *
 * NO LANGUAGE OF ITS OWN TO PICK BETWEEN except the price floor. Every string here is a `t` key
 * resolved by the provider and nothing comes from the catalogue, so `lang` is carried for
 * `formatPrice` alone — the same check `CheckoutBuyerSection` made when it refused the prop.
 *
 * THE PRICE FIELD IS TEXT AND NOT THE DESIGN'S `type="number"`. A number input parses its content
 * with the BROWSER's locale, not the page's: on an English-locale Chromium `19,99` is not a valid
 * number, the comma is dropped as it is typed, and the field ends up holding `1999` — which reads
 * back as one thousand nine hundred and ninety-nine reais. A money field that turns R$ 19,99 into
 * R$ 1.999,00 depending on a setting nobody in this panel controls is the worst available failure,
 * so the parsing is `centsFromReais`, which accepts both separators and neither browser's opinion.
 * The cost is the mobile keypad, which `inputMode` would restore and which `TextInput` does not
 * carry — a primitive change, and out of this task's scope.
 *
 * STOCK IS TEXT FOR THE SAME REASON plus one of its own: a number input hands back `''` for
 * content it considers invalid, so `1e` and `--` are indistinguishable from an empty field, and an
 * empty field is where a silent 0 comes from.
 *
 * THE 6 LABELS ARE `FieldLabel`, unmodified. The design draws them at `opacity:.75`, which is
 * 7.39:1 on paper and which is what the primitive already is; the branch's "below opacity-65 fails
 * AA" rule is about the muted meta lines and does not apply to these.
 */
export function ProductBasicsFields({ values, lang, errors, onChange }: ProductBasicsFieldsProps) {
  const { t } = useTranslation()
  const errorFor = useFieldError(errors)
  const set = <K extends keyof ProductBasicsValues>(field: K, value: ProductBasicsValues[K]) =>
    onChange({ ...values, [field]: value })

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] items-start gap-4">
      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor={SLUG_ID}>{t('Identifier')}</FieldLabel>
        {/* The placeholder is an example slug and follows the panel's language, unlike the two
            subtitle examples the design also draws: those belong to a COLUMN's language rather
            than to the reader's, which no key resolved by the provider can express. */}
        <TextInput
          id={SLUG_ID}
          value={values.slug}
          placeholder={t('handwritten-letter')}
          error={errorFor('slug')}
          onChange={(v) => set('slug', v)}
        />
      </div>

      <div className="flex flex-col gap-2">
        {/* The floor is in the label rather than in an error nobody has triggered yet, and it is
            formatted from the same cents the schema counts in, so it reads R$ 1,00 and not 100. */}
        <FieldLabel htmlFor={PRICE_ID} hint={t('minimum {{price}}', { price: formatPrice(MIN_PRICE_CENTS, lang) })}>
          {t('Price (R$)')}
        </FieldLabel>
        <TextInput
          id={PRICE_ID}
          value={values.price}
          error={errorFor('priceCents')}
          onChange={(v) => set('price', v)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor={STOCK_ID}>{t('Stock')}</FieldLabel>
        <TextInput
          id={STOCK_ID}
          value={values.stock}
          disabled={values.unlimitedStock}
          error={errorFor('stock')}
          onChange={(v) => set('stock', v)}
        />
        {/*
          THE ONE CONTROL THE DESIGN DOES NOT HAVE. Its number input cannot say
          `stock: null`, and null is not a smaller number than 1 — it is the absence of a limit.
          Leaving the box empty to mean it collides with the box being empty because nothing has
          been typed yet, and 0 already means sold out.

          The word is the row's word, branched on the type exactly as the products table branches
          it: no limit on a physical piece is made to order, and on a digital one it is simply
          unlimited. Two literal keys and a condition, which is the idiom the copy scanner can see.

          The box wraps its own label, so the association needs no id, and the ring is the one
          CheckoutShippingSection's radio settled on: 2px accent pulled INSIDE the row, because a
          2px outline around an 11px control is an indicator nobody sees.

          THE 75% SITS ON THE WORD AND NOT ON THE ROW. It is the label recipe's opacity, and a
          label recipe has no business dimming a control: inside it the box itself would be drawn
          at 75% too, which is a graphical object fading towards SC 1.4.11's 3:1 floor to match
          the styling of the text beside it.
        */}
        <label className="font-mono has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={values.unlimitedStock}
            className="accent-ink size-[11px] shrink-0"
            onChange={(e) => set('unlimitedStock', e.target.checked)}
          />
          <span className="text-[10px] uppercase tracking-[0.16em] opacity-75">
            {values.type === 'digital' ? t('Unlimited') : t('Made to order')}
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor={TYPE_ID}>{t('Type')}</FieldLabel>
        {/* Sentence case, and a second pair of keys next to the table's lowercase `physical` and
            `digital`. Those two are written lowercase because the cell that renders them is
            uppercased by CSS; an option is not, so it would be the only lowercase word in a row
            of controls, next to a status select that says Ativo. Same fact, different register. */}
        <Select
          id={TYPE_ID}
          value={values.type}
          options={[
            { value: 'physical', label: t('Physical') },
            { value: 'digital', label: t('Digital') },
          ]}
          onChange={(v) => set('type', v === 'digital' ? 'digital' : 'physical')}
        />
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor={ACTIVE_ID}>{t('Status')}</FieldLabel>
        {/* `Ativo` / `Inativo`, the table's pair, and not the design's third and fourth words for
            the same two states (`Ativo na loja` / `Desabilitado`). */}
        <Select
          id={ACTIVE_ID}
          value={values.active ? 'active' : 'inactive'}
          options={[
            { value: 'active', label: t('Active') },
            { value: 'inactive', label: t('Inactive') },
          ]}
          onChange={(v) => set('active', v === 'active')}
        />
      </div>

      <div className="flex flex-col gap-2">
        {/*
          THE SIXTH FIELD. spec:46 lists it among the form's new ones and no task built it, so
          until now the piece the home page leads with could only be chosen by editing the
          document by hand.

          A SELECT AND NOT A BOX, because this row already decided that for a boolean: `active` is
          one and it is a Select with both states named. The reason applies twice over here — the
          off state is not "hidden", it is "in the catalogue like everything else", which a bare
          box leaves unsaid. The checkbox two cells over is a SECOND control inside a field that
          already has one, which is a different problem with a different answer.

          THE SENTENCE UNDER THE CONTROL IS THE WHOLE DESIGN OF THIS CELL, and it is there because
          the two option words cannot carry it. `featured` is a single-winner flag WITH NO
          UNIQUENESS CONSTRAINT ANYWHERE: not in `productInputSchema`, not in the Mongoose model,
          not in the PUT. The shop breaks the tie by taking the first ACTIVE product carrying it,
          in catalogue order (spec:58) — so
          marking a second piece does not move the hero, it silently joins a queue. A field
          labelled `Destaque` would promise a guarantee the backend does not make; naming the
          field for the home page and stating the rule under it promises only what happens.

          ENFORCING THE GUARANTEE FROM HERE WAS THE ALTERNATIVE AND IT COSTS TWO WRITES. There is
          no endpoint that clears the flag elsewhere, so the panel would have to PUT a second,
          unopened product assembled from a cached copy — Task 8's whole-document hazard, aimed at
          a product the reader never looked at — with a window in between where the shop has two
          heroes or none, and no honest sentence to show when only the first write lands.
        */}
        <FieldLabel htmlFor={FEATURED_ID}>{t('Home page')}</FieldLabel>
        <Select
          id={FEATURED_ID}
          describedBy={FEATURED_NOTE_ID}
          value={values.featured ? 'marked' : 'unmarked'}
          options={[
            { value: 'marked', label: t('Marked') },
            { value: 'unmarked', label: t('Not marked') },
          ]}
          onChange={(v) => set('featured', v === 'marked')}
        />
        {/*
          A DESCRIPTION AND NOT A LABEL HINT, which is where this sentence started. Inside the
          label it became part of the control's NAME and wrapped to three lines in a 179px cell,
          leaving this select sitting 30px below the five controls beside it — the row stops
          reading as a row. As a description it is announced after the name, it sits under the
          control where the stock cell puts its second line, and the label above stays one line
          like its neighbours.

          `opacity-65` is the branch's muted-note level and its floor: the same 65% the form's two
          other notes use, measured rather than assumed in the stories beside this file.
        */}
        <p id={FEATURED_NOTE_ID} className="font-mono text-[10px] leading-[1.5] tracking-[0.04em] opacity-65">
          {t('The home page opens with the first active piece marked here.')}
        </p>
      </div>
    </div>
  )
}
