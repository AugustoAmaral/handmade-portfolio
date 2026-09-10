import type { ReactNode } from 'react'
import { EYEBROW_TYPE } from './Eyebrow'

/**
 * The prototype's ruled section header: the eyebrow's type at FULL ink over a 1px rule, with an
 * optional action sharing the rule on the right.
 *
 * WHY THIS IS A PRIMITIVE AND NOT AN `Eyebrow` VARIANT. `Eyebrow` is a muted `<div>` tag at
 * `opacity-65`; this is a heading at full strength inside its own layout, and the prototype draws
 * it that way on purpose — the extract measured it. A `ruled` prop would have had to swap the
 * element, drop the opacity, add a border, add padding and add a second slot, which is a different
 * component wearing the same name. What the two genuinely share is the type recipe, and that is
 * what `EYEBROW_TYPE` now holds.
 *
 * WHY IT EXISTS AT ALL. The class string appears four times in the admin product form — the two
 * language columns, the photos section and the specs section. Task 4 inlined it once; these two
 * sections would have made it three and four. The extract offered the choice and nobody had made
 * it, and this branch has already shipped four copies of `interceptableAnchor` and six of the
 * contrast helper before hoisting each of them under duress.
 *
 * THE RULE IS ON THE WRAPPER, NOT ON THE HEADING. With the border on the heading, an action beside
 * it sits outside the line the design draws under both. Baseline alignment is the design's too:
 * the action is not a second row.
 *
 * `<h2>` IS FIXED HERE, following Task 4. The admin page (Task 7) owns the `<h1>` and the outline;
 * every in-form section is a peer of every other, so a level prop would only ever be used to get
 * the outline wrong.
 */
export function SectionRule({
  id,
  children,
  action,
  className = '',
}: {
  id?: string
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={`border-ink flex flex-wrap items-baseline justify-between gap-4 border-b pb-2.5 ${className}`}>
      <h2 id={id} className={EYEBROW_TYPE}>
        {children}
      </h2>
      {action}
    </div>
  )
}
