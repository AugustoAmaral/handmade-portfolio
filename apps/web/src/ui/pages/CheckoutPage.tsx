import type { FieldErrors, ShippingMethod, ShippingMethodInfo } from '@shop/shared'
import { hasPhysicalItems } from '@shop/shared'
import { useTranslation } from 'react-i18next'
import { Eyebrow } from '../primitives'
import {
  type AddressValues,
  BackBar,
  type BuyerValues,
  type CartLineData,
  CheckoutAddressSection,
  CheckoutBuyerSection,
  CheckoutNotesSection,
  CheckoutPaymentSection,
  CheckoutShippingSection,
  type NotesValues,
  OrderSummaryPanel,
} from '../shop'

export interface CheckoutPageProps {
  lang: 'pt' | 'en'
  buyer: BuyerValues
  address: AddressValues
  notes: NotesValues
  /** One flat map for the whole form, keyed as the API keys it (`buyer.name`, `shippingAddress.cep`,
   *  `shippingMethod`, `notes`); each section reads only the keys it owns. */
  errors: FieldErrors
  shippingOptions: readonly ShippingMethodInfo[]
  shippingMethod: ShippingMethod | null
  /** `SHIPPING_METHODS[m].name[lang]`, resolved by the container; `null` until one is chosen. */
  shippingMethodName: string | null
  lines: CartLineData[]
  itemsCents: number
  shippingCents: number | null
  totalCents: number
  submitting: boolean
  /** An API error CODE, not a sentence — `OrderSummaryPanel` translates it. */
  submitError: string | null
  /**
   * The id of the `<form>` the container wrapped this page in, passed straight through to the
   * summary's button. Given one, that button becomes the form's submit control and Enter in any
   * field submits; left out, the page renders exactly as it did before Task 11 and `onSubmit` is
   * the only path. See the paragraph below on why the association has to be stated.
   */
  submitFormId?: string
  onBuyerChange(field: keyof BuyerValues, value: string): void
  onAddressChange(field: keyof AddressValues, value: string): void
  onNotesChange(field: keyof NotesValues, value: string): void
  onSelectShipping(method: ShippingMethod): void
  onOpenCart(): void
  onSubmit(): void
}

/**
 * The checkout: five sections down the left, the order and the one button down the right.
 *
 * WHETHER THE ORDER SHIPS IS DERIVED, NOT PASSED. `hasPhysicalItems(lines)` is the same function
 * `computeTotals` uses to decide whether to charge postage and the same one the API passes to
 * `checkoutRules`, so the address section, the shipping section and the shipping charge are three
 * consequences of one fact instead of three opinions about it. A `needsShipping` boolean prop was
 * the alternative and it is a second place for the answer to be computed: a container that got it
 * wrong would show an address form for a digital-only bag whose totals charge nothing and whose
 * submit the API accepts without one. This is what `CartLineData.type` was added for in step 0a.
 *
 * THE `<form>` IS THE CONTAINER'S, and this page only says which one it is. The submit control
 * lives in the other grid column, inside `OrderSummaryPanel`, so a form wrapping the FIELDS would
 * contain no submit button and HTML's implicit submission — which needs one, or a single field
 * that blocks it — would leave sixteen inputs doing nothing on Enter. Task 11 wraps the whole page
 * instead and passes its id down: the button quotes it back through `form=`, the association is
 * stated rather than inherited from where the markup happens to sit, and clicking the button and
 * pressing Enter become the same activation of the same control. Absent the prop this page is
 * exactly what it was, which is what keeps Task 9's stories describing it.
 *
 * THE SUMMARY COLUMN IS STICKY AND THE PROTOTYPE'S IS NOT, though both say `position:sticky`. The
 * design pairs it with `align-items:start`, which shrinks the grid item to its content, and a
 * sticky element with no room in its containing block never moves. Letting the cells stretch —
 * which is also what the hairline grid needs, since a start-aligned cell stops painting `bg-paper`
 * where it ends and lets the container's ink through under it — gives the sticky column the travel
 * the design was asking for.
 *
 * THE BAR IS THE SHARED `BackBar` with the checkout's two items in it. Its left item is a
 * `<button>`, not the product page's link: it opens the drawer over this page, so an `<a href>`
 * would be announcing a destination it does not go to.
 *
 * `Pagamento seguro via Stripe` sits at `opacity-65`, not the prototype's `.5` (3.30:1 at 11px).
 */
export function CheckoutPage({
  lang,
  buyer,
  address,
  notes,
  errors,
  shippingOptions,
  shippingMethod,
  shippingMethodName,
  lines,
  itemsCents,
  shippingCents,
  totalCents,
  submitting,
  submitError,
  submitFormId,
  onBuyerChange,
  onAddressChange,
  onNotesChange,
  onSelectShipping,
  onOpenCart,
  onSubmit,
}: CheckoutPageProps) {
  const { t } = useTranslation()
  const ships = hasPhysicalItems(lines)
  return (
    <>
      <BackBar>
        <button type="button" onClick={onOpenCart} className="opacity-70">
          <span aria-hidden="true">←</span> {t('Back to the bag')}
        </button>
        <span className="opacity-65">{t('Secure payment via Stripe')}</span>
      </BackBar>
      <div className="bg-ink grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-px">
        <div className="bg-paper flex flex-col gap-[clamp(28px,4vw,44px)] p-[clamp(28px,5vw,64px)]">
          <div>
            <Eyebrow>{t('Complete your order')}</Eyebrow>
            <h1 className="font-display mt-3 text-[clamp(34px,4.6vw,56px)] leading-[1.02] text-balance">
              {t('Where I send it, and to whom.')}
            </h1>
          </div>
          <CheckoutBuyerSection values={buyer} errors={errors} onChange={onBuyerChange} />
          {ships ? <CheckoutAddressSection values={address} errors={errors} onChange={onAddressChange} /> : null}
          {ships ? (
            <CheckoutShippingSection
              options={shippingOptions}
              selected={shippingMethod}
              lang={lang}
              errors={errors}
              onSelect={onSelectShipping}
            />
          ) : null}
          <CheckoutNotesSection values={notes} errors={errors} onChange={onNotesChange} />
          <CheckoutPaymentSection />
        </div>
        <div className="bg-paper p-[clamp(28px,5vw,64px)]">
          <div className="sticky top-20">
            <OrderSummaryPanel
              lines={lines}
              itemsCents={itemsCents}
              shippingCents={shippingCents}
              totalCents={totalCents}
              shippingMethodName={shippingMethodName}
              lang={lang}
              submitting={submitting}
              submitError={submitError}
              submitFormId={submitFormId}
              onSubmit={onSubmit}
            />
          </div>
        </div>
      </div>
    </>
  )
}
