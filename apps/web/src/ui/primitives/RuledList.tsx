import type { ReactNode } from 'react'

/**
 * The prototype's hairline list: a 1px ink grid gap showing through between paper rows.
 *
 * `as` EXISTS FOR ONE CALLER AND IS NOT A POLYMORPHIC PRIMITIVE. The admin order detail's contact
 * block is this exact recipe — the extract measured `flex flex-col gap-px bg-ink border border-ink`
 * against the prototype and found it verbatim — and it is a list of terms and values, so it has to
 * be a `<dl>`. Wrapping a `<dl>` inside the `<div>` would put one flex child in the grid and
 * collapse every hairline; copying the nine classes into the caller is the drift this primitive
 * exists to prevent. The union is spelled out rather than generic on purpose: two elements have a
 * reason to be here and `as={Component}` would invite the third with no reason at all.
 */
export function RuledList({
  children,
  as: Element = 'div',
  className = '',
}: {
  children: ReactNode
  as?: 'div' | 'dl'
  className?: string
}) {
  return <Element className={`bg-ink border-ink flex flex-col gap-px border ${className}`}>{children}</Element>
}

/**
 * One paper cell of that grid. `bg-paper` is the load-bearing half and the reason this is a
 * primitive rather than two utility classes: a row that forgets it shows ink through, which reads
 * as a rendering fault rather than as a missing class.
 *
 * `as` FOR THE SAME REASON `RuledList` HAS ONE, and it took the sweep to close it. Inside a `<dl>`
 * a `<div>` wrapping one `<dt>` and one `<dd>` is the standard grouping and is what the order
 * detail needs; `CheckoutShippingSection`'s row is a `<label>` wrapping a radio, which is what a
 * clickable option has to be — and it had the three classes copied out because a `<div>` could not
 * be it. Two elements with a reason, spelled out rather than generic, exactly as above.
 */
export function RuledRow({
  children,
  as: Element = 'div',
  className = '',
}: {
  children: ReactNode
  as?: 'div' | 'label'
  className?: string
}) {
  return <Element className={`bg-paper px-4 py-3.5 ${className}`}>{children}</Element>
}
