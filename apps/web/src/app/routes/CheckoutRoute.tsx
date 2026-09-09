import {
  type FieldErrors,
  SHIPPING_METHODS,
  type ShippingMethod,
  checkoutRequestSchema,
  checkoutRules,
  computeTotals,
  hasPhysicalItems,
  shippingOptionsFor,
} from '@shop/shared'
import { type FormEvent, useState } from 'react'
import { CheckoutPage } from '../../ui/pages'
import type { AddressValues, BuyerValues, NotesValues } from '../../ui/shop'
import { ApiError } from '../api/client'
import { useCheckout, useProducts } from '../api/queries'
import { useShop } from '../ShopShellContainer'

/**
 * The `<form>` the fields live in and the id the summary's button quotes back. It exists at all
 * because of where the button is: the checkout's only submit control sits in the OTHER grid
 * column, inside `OrderSummaryPanel`, and HTML's implicit submission needs a submit control the
 * form owns before Enter in a text field does anything. Sixteen inputs and no Enter is a real
 * defect on the highest-stakes screen in the shop, and this is the whole of the fix: the form
 * wraps the page, the button declares which form it belongs to, and the browser does the rest.
 */
export const CHECKOUT_FORM_ID = 'checkout-form'

/**
 * The country the form starts on.
 *
 * PRE-FILLED, and the alternative was measured rather than guessed. Left blank,
 * `shippingOptionsFor('')` is empty and the very first thing a Brazilian buyer reads under
 * "03 · Envio" is "Nenhuma opção de envio para este endereço" — a shop announcing it ships nowhere,
 * on a home page that says "Envio para todo o Brasil", before a single character is typed. Filled
 * with BR, PAC and SEDEX are on screen and choosable immediately, and the field's own value shows
 * what shape it wants (two letters, not "Brasil").
 *
 * IT CHANGES WHICH ERRORS A FIRST SUBMIT PRODUCES, which is the half worth stating. Blank, the
 * country fails `shippingAddressSchema`'s `.length(2)` and comes back as one of zod's raw English
 * sentences, because the API copies `issue.message` straight through and only the cross-field
 * rules speak in codes the translation table knows. Filled, the country passes the schema and the
 * address's remaining failures arrive as `invalid_cep`, `required` and `invalid_state` — codes with
 * Portuguese behind them. Pre-filling therefore removes an untranslated sentence from the first
 * submit rather than adding one. An international buyer pays two keystrokes for it.
 */
const DEFAULT_COUNTRY = 'BR'

const EMPTY_BUYER: BuyerValues = { name: '', email: '', phone: '' }
const EMPTY_ADDRESS: AddressValues = {
  country: DEFAULT_COUNTRY,
  postalCode: '',
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  state: '',
}
const EMPTY_NOTES: NotesValues = { notes: '', giftMessage: '', referral: '' }

/** An untouched optional field is absent, not empty: the order should not carry `""` for a phone. */
function optional(value: string): string | undefined {
  return value.trim() === '' ? undefined : value
}

/**
 * The same shape `apps/api/src/errors.ts:26-33` builds from a ZodError — keyed by
 * `issue.path.join('.')`, `_` for an issue with no path — so a rejection the browser catches lands
 * on exactly the fields a rejection from the API would. It is a SECOND COPY of that mapping and
 * that is worth fixing upstream: it belongs in `@shop/shared` beside the schema it decodes, next
 * to `checkoutRules`, rather than once in an express error handler and once here.
 */
function fieldErrorsOf(issues: readonly { path: (string | number)[]; message: string }[]): FieldErrors {
  const errors: FieldErrors = {}
  for (const issue of issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_'
    ;(errors[key] ??= []).push(issue.message)
  }
  return errors
}

/**
 * `UNKNOWN_ITEM` and `OUT_OF_STOCK` name the offending piece in their MESSAGE and nowhere else —
 * `routes/checkout.ts:29,31` throws `Unknown item: ${slug}` and `Not enough stock for: ${slug}`
 * with no `fieldErrors` — so the slug is recovered the way v1 recovered it. It is a fragile
 * contract and the honest fix is on the API side (the code carries a `fieldErrors` the way
 * `VALIDATION` does); until then, a message that stops matching yields a slug that matches no line
 * and removes nothing, which is the safe direction to fail.
 */
function offendingSlug(message: string): string {
  return message.replace(/^.*:\s*/, '')
}

/**
 * The checkout: the one container with real logic in it.
 *
 * THE BROWSER REJECTS EXACTLY WHAT THE API REJECTS, in the same order and by the same functions.
 * `checkoutRequestSchema.parse` first, then `checkoutRules` over the PARSED request — which is the
 * order `routes/checkout.ts` runs them in (:21 then :36), and it is why the two kinds of error
 * never arrive mixed. Running the rules over the raw form instead would branch on `br ` where the
 * API branches on `BR`, and hand a Brazilian buyer the international form and then an `invalid_cep`
 * from a server that disagreed about which country this is.
 *
 * TOTALS ARE DISPLAY ONLY. `computeTotals` runs on the catalogue's prices so the buyer sees the
 * number before they leave; the API re-prices from Mongo and Stripe charges what the API says.
 *
 * THE CHOSEN SHIPPING METHOD IS DERIVED, NOT STORED. A method is a selection only while the
 * country still offers it: pick SEDEX, then change the country to FR, and a stored `sedex` would
 * leave the summary charging R$ 41,00 for a service that does not go there while no radio on
 * screen is checked. Filtering the stored value through the current options at render time makes
 * the summary, the radios and the POST one answer instead of three.
 *
 * THE ADDRESS AND SHIPPING SECTIONS ARE THE PAGE'S DECISION, not this container's: it derives them
 * from `hasPhysicalItems(lines)`, the same function `computeTotals` and `checkoutRules` use, so
 * this file passes the lines and says nothing about whether they ship.
 */
export function CheckoutRoute() {
  const { lang, cart, lines, openCart } = useShop()
  const { isPending: catalogPending } = useProducts()
  const [buyer, setBuyer] = useState<BuyerValues>(EMPTY_BUYER)
  const [address, setAddress] = useState<AddressValues>(EMPTY_ADDRESS)
  const [notes, setNotes] = useState<NotesValues>(EMPTY_NOTES)
  const [chosenMethod, setChosenMethod] = useState<ShippingMethod | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const checkout = useCheckout()

  const totalsLines = lines.map((line) => ({ priceCents: line.unitCents, qty: line.qty, type: line.type }))
  const ships = hasPhysicalItems(totalsLines)
  // Normalised the way zod normalises it, so the options offered are the options the rules accept.
  const country = address.country.trim().toUpperCase()
  const shippingOptions = shippingOptionsFor(country)
  const shippingMethod = shippingOptions.some((option) => option.id === chosenMethod) ? chosenMethod : null
  const totals = computeTotals(totalsLines, shippingMethod)

  function submit() {
    setSubmitError(null)
    const request = {
      items: lines.map((line) => ({ slug: line.slug, qty: line.qty })),
      locale: lang,
      buyer: { name: buyer.name, email: buyer.email, phone: optional(buyer.phone) },
      shippingAddress: ships
        ? {
            country: address.country,
            postalCode: address.postalCode,
            street: address.street,
            number: optional(address.number),
            complement: optional(address.complement),
            district: optional(address.district),
            city: address.city,
            state: optional(address.state),
          }
        : undefined,
      shippingMethod: ships ? (shippingMethod ?? undefined) : undefined,
      notes: optional(notes.notes),
      giftMessage: optional(notes.giftMessage),
      referral: optional(notes.referral),
    }

    const parsed = checkoutRequestSchema.safeParse(request)
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error.issues))
      // The button is at the bottom of a screen the fields have scrolled off. Without a line beside
      // it, a rejected submit looks like a button that does nothing.
      setSubmitError('VALIDATION')
      return
    }

    const ruleErrors = checkoutRules(parsed.data, ships)
    if (ruleErrors) {
      setErrors(ruleErrors)
      setSubmitError('VALIDATION')
      return
    }

    setErrors({})
    checkout.mutate(parsed.data, {
      onSuccess: ({ url }) => window.location.assign(url),
      onError: (error) => {
        // `useCheckout` types this as an ApiError, and a request that never reaches the server
        // rejects with a TypeError instead. Reading `.code` off that gives `undefined`, which is
        // falsy, which renders no alert at all — a submit that fails in silence.
        const code = error instanceof ApiError ? error.code : 'INTERNAL'
        if (error instanceof ApiError) {
          if (code === 'OUT_OF_STOCK' || code === 'UNKNOWN_ITEM') cart.remove(offendingSlug(error.message))
          if (error.fieldErrors) setErrors(error.fieldErrors)
        }
        setSubmitError(code)
      },
    })
  }

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    // The form never navigates: the only way out of this page is the URL Stripe gives back.
    event.preventDefault()
    submit()
  }

  // Nothing until the catalogue is in, because until then there are no lines and the panel would
  // paint "A sacola está vazia" over a bag that is not.
  if (catalogPending) return null

  return (
    // `noValidate` because the fields already have a validator: this one, running the API's own
    // schema and rules and speaking Portuguese. The browser's would fire first on the `type=email`
    // field, block the submit with a bubble in the browser's language, and the translated errors
    // beside the fields would never be reached.
    <form id={CHECKOUT_FORM_ID} noValidate onSubmit={onFormSubmit}>
      <CheckoutPage
        lang={lang}
        buyer={buyer}
        address={address}
        notes={notes}
        errors={errors}
        shippingOptions={shippingOptions}
        shippingMethod={shippingMethod}
        shippingMethodName={shippingMethod ? SHIPPING_METHODS[shippingMethod].name[lang] : null}
        lines={lines}
        itemsCents={totals.itemsCents}
        // `null` is the em dash plus "escolha uma opção de envio". A bag with nothing to post has
        // no option to choose, so it shows the real zero it will really be charged.
        shippingCents={shippingMethod || !ships ? totals.shippingCents : null}
        totalCents={totals.totalCents}
        submitting={checkout.isPending}
        // A CODE, never a sentence. `OrderSummaryPanel` puts it through the same table as the field
        // errors; a sentence built here would be copy resolved outside `src/ui`, where
        // `copy.test.ts` cannot see it and a missing translation ships as fluent English.
        submitError={submitError}
        submitFormId={CHECKOUT_FORM_ID}
        onBuyerChange={(field, value) => setBuyer((previous) => ({ ...previous, [field]: value }))}
        onAddressChange={(field, value) => setAddress((previous) => ({ ...previous, [field]: value }))}
        onNotesChange={(field, value) => setNotes((previous) => ({ ...previous, [field]: value }))}
        onSelectShipping={setChosenMethod}
        onOpenCart={openCart}
        onSubmit={submit}
      />
    </form>
  )
}
