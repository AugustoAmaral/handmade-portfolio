/**
 * The two facts about the shop itself that more than one surface has to state.
 *
 * Neither is copy. `SHOP_NAME` is a proper noun and is never translated — it reads the same in both
 * languages and has no `pt.json` entry — and a time zone is configuration. Putting them through
 * `t()` would put them in front of the copy scan for no reason and invite a translation of a name.
 */

/**
 * The shop's name, as the two headers print it.
 *
 * IT WAS TWO PRIVATE CONSTANTS AND NOTHING ASSERTED EITHER, which is the part that made the
 * duplication worth closing: `ShopHeader` and `AdminHeader` each declared their own and no test or
 * story read the rendered name, so the two could have drifted apart for a whole PR without anything
 * going red. `apps/web/index.html` carries a third copy in its `<title>`; static HTML can import
 * nothing, so that one is named rather than fixed.
 */
export const SHOP_NAME = 'My Handmade Portfolio'

/**
 * The zone every date in the panel is rendered in, beside `formatPrice` for the same reason it is
 * beside it: `createdAt` is an INSTANT, and an unpinned "05 set" is two different days on two
 * machines. The panel is one person in one country, so the shop's own zone is the right answer and
 * the browser's is not.
 *
 * The API has no date formatting today. When it grows one — an order confirmation printing a date —
 * this is the value it must use, and that is why it is here rather than in `apps/web`.
 */
export const SHOP_TIME_ZONE = 'America/Sao_Paulo'
