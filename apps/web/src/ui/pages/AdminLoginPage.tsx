import { LoginCard, type LoginCardProps } from '../admin'

/** Exactly the card's contract: this page adds where it sits and nothing else. */
export type AdminLoginPageProps = LoginCardProps

/**
 * The panel's front door: one card, centred, and nothing else in the `<main>`.
 *
 * THE DESIGN HAS NO LOGIN SCREEN AT ALL — `senha`, `login`, `token`, `entrar`, `sair`, `logout` and
 * `password` return zero hits across the prototype's 975 lines, and `goAdmin` flips a flag with no
 * gate. Task 2 invented the card out of the dark bar's own vocabulary; what is left for the page is
 * the one thing a card cannot decide: that it is the whole screen.
 *
 * NO HEADING OF ITS OWN. `LoginCard`'s `Entrar no painel` is an `<h1>` and is the document's only
 * heading, so a band above it saying `Painel` would be the same sentence twice and would push the
 * real title to `<h2>`. The card's eyebrow already says `Painel`.
 *
 * IT IS A PASS-THROUGH AND IT IS SPREAD, so the page cannot silently drop a prop the card grows —
 * the failure a page whose only job is layout is actually capable of.
 *
 * CENTRED VERTICALLY IN THE VIEWPORT THE BAR LEAVES, which no other screen in the panel does: the
 * products and orders screens open with a header band against the bar, and a single 420px card
 * pinned to the top of a working screen reads as a screen that failed to finish loading.
 */
export function AdminLoginPage(props: AdminLoginPageProps) {
  return (
    <div className="px-gutter-admin flex min-h-[70vh] items-center py-[clamp(40px,7vw,80px)]">
      <LoginCard {...props} />
    </div>
  )
}
