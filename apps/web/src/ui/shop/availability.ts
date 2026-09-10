import type { PublicProduct } from '@shop/shared'
import { useTranslation } from 'react-i18next'

/**
 * One sentence for "can I buy this, and what happens if I do", shared by the catalogue card and
 * the product page because the prototype prints the same label in both places
 * (`prod.type === "digital" ? … : prod.stock + " em estoque"`, twice).
 *
 * THE ORDER OF THE BRANCHES IS THE WHOLE THING. `stock === 0` is checked BEFORE `digital`, because
 * a digital piece whose stock ran to zero is sold out, and "entrega por e-mail" over something
 * nobody can buy is worse than saying nothing. `stock === null` means made to order (spec:53), and
 * only after all three does a number mean a count. The digital wording is spec:221's, which
 * overrides the prototype's `download imediato`: there is no automatic download.
 *
 * A HOOK RETURNING A FUNCTION, the shape `useErrorMessage` already uses in `CheckoutSection`:
 * `useTranslation` has to be called from a component, and the caller has a product in hand rather
 * than at render time. Spelled out as four literal `t()` calls rather than a lookup table for the
 * reason `copy.test.ts` forces on everything here — it reads keys out of literal call sites and
 * pins the number of runtime-built ones at exactly one.
 *
 * Extracted in Task 10 from `ProductCard`, which had it inline and would otherwise have had a twin
 * on the product page. Two copies of a four-branch ladder whose order is the interesting part is
 * how the corrected order gets fixed in one of them.
 */
export function useAvailabilityLabel(): (product: PublicProduct) => string {
  const { t } = useTranslation()
  return (product) =>
    product.stock === 0
      ? t('Sold out')
      : product.type === 'digital'
        ? t('Delivered by e-mail')
        : product.stock === null
          ? t('Made to order')
          : t('{{count}} in stock', { count: product.stock })
}
