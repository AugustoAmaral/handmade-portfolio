# PR 3 — Prototype extract (copy, structure, and what the design does not give us)

Companion to `2026-09-09-webshop-v2-03-web-storefront.md`. Extracted from `design-claude-design/My Handmade Portfolio.dc.html` (975 lines), which is the approved visual source of truth.

**Read this before building any component in Tasks 5–10.** The plan says what to build and how to test it; this file carries the fidelity. Where the two disagree, the prototype wins on appearance and copy, and the plan wins on semantics and behaviour.

---

## 0. What the prototype actually is

It is a Claude Design `.dc.html` export, not React and not Tailwind.

- **Zero `class` attributes in the entire file.** Every visual decision is an inline `style="…"` with raw hex, raw px and raw `clamp()`. There are no Tailwind strings to copy — every class in this document is a derivation, and must be checked against the inline style it came from.
- Proprietary template attributes: `<sc-if value="{{ x }}">` (conditional), `<sc-for list="{{ xs }}" as="i">` (repeat), `style-hover="…"` (hover declarations → a `hover:` variant), `onClick="{{ handler }}"`, `<image-slot>` (image placeholder custom element).
- Data lives in a `<script type="text/x-dc">` block: `SEED` (catalogue), `ORDERS`, `SHIP`, and `renderVals()`.
- `hint-placeholder-count` values are editor stubs, NOT real counts. Real counts: 4 products, 4 specs per product, 3 about blocks, 4 about facts.

### The one global stylesheet, verbatim

```css
body { margin: 0; background: #f4f0e6; }
a { color: #1a1713; text-decoration: none; }
a:hover { color: #a63d20; }
input, button, select, textarea { font: inherit; color: inherit; }
input, select, textarea { background: transparent; border: 1px solid #1a1713; padding: 12px 13px; font-family: 'IBM Plex Mono', monospace; font-size: 13px; outline: none; width: 100%; box-sizing: border-box; border-radius: 0; }
input:focus, select:focus, textarea:focus { border-color: #a63d20; }
textarea { resize: vertical; line-height: 1.5; }
@keyframes drawerIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
@keyframes scrimIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes riseIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
```

**The prototype's form styling is already rejected.** `outline:none` plus a focus border hue change measured 2.81:1 where WCAG 2.2 requires 3:1, and signalled focus by hue alone — PR 2 replaced it with a 2px accent outline at 2px offset, and `TextInput.stories.tsx` measures it. Do not reintroduce the prototype's version when building the checkout fields; use the PR 2 primitives, which already carry the accessible treatment.

The three `@keyframes` must be added to `index.css` if the animations are kept (`animate-[riseIn_.3s_ease_both]` etc.). They are decoration; if `prefers-reduced-motion` handling is not also added, prefer dropping them.

---

## 1. Token mapping — every colour in the prototype

| Raw | Token | Where |
|---|---|---|
| `#f4f0e6` | `paper` | root bg, sticky header bg, every hairline-grid cell, featured card, image frames, filled-button text |
| `#efe9db` | `paper-2` | product-card hover, Product page left panel, shipping-option row hover |
| `#e6dfcd` | `paper-3` | outline-button hover, quantity stepper hover |
| `#1a1713` | `ink` | all 1px rules, hairline-grid backgrounds, filled buttons, root text |
| `#a63d20` | `accent` | all button hovers, global `a:hover`, prototype's input focus border |
| `rgba(26,23,19,.2)` | `ink/20` | product image frame borders, cart-line divider |
| `rgba(26,23,19,.25)` | `ink/25` | product footer-note top rule, drawer Total row top rule |
| `rgba(26,23,19,.35)` | `ink/35` | cart-line thumbnail border |
| `rgba(26,23,19,.42)` | `ink/42` | drawer scrim |
| `rgba(26,23,19,.5)` | `ink/50` | unselected shipping radio ring |
| `#e9e2d1` | **none** | cart-line thumbnail placeholder background — the ONLY off-palette colour |

Fonts: `'Instrument Serif',serif` → `font-display`; `Newsreader,Georgia,serif` → `font-body`; `'IBM Plex Mono',monospace` → `font-mono`.

**Decision needed in Task 5:** `#e9e2d1` is used once, for the drawer's thumbnail placeholder. Either add a token or use `paper-2`. Do not inline a raw hex — the tokens exist so a palette change is one edit.

**Opacity is element opacity, not text alpha.** `opacity:.55` on a row dims its borders and background too. Converting to `text-ink/55` changes the render. Keep `opacity-*`, and remember the PR 2 finding: below `opacity-65`, muted text on paper does not clear 4.5:1.

### The page gutter

`clamp(20px,5vw,64px)` appears verbatim **6 times** as the horizontal page padding. Promote it to a token (`--spacing-gutter`) in Task 5 rather than repeating the arbitrary value; every later component uses it.

### The hairline grid

Used for the catalog grid, the specs table, the shipping options, the checkout summary and the done-page rows: a container with `gap:1px` over `background:#1a1713`, whose children each paint `background:#f4f0e6`. The gaps read as 1px rules with no double borders. Tailwind: `gap-px bg-ink` on the container, `bg-paper` on each cell.

The drawer's cart lines are the exception — they use a real `border-bottom: 1px solid rgba(26,23,19,.2)` per line.

### The two button variants

| | filled | outline |
|---|---|---|
| base | `bg-ink text-paper rounded-full` | `border border-ink rounded-full` |
| hover | `hover:bg-accent` | `hover:bg-paper-3` |
| padding | varies per instance: `14px 26px`, `15px 30px`, `15px 0`, `17px 0` | `14px 26px`, `15px 32px` |

All are mono 12px uppercase `tracking-[.08em]` or `.1em`. `PillButton` from PR 2 already implements both variants — use it, and reconcile the padding differences into its size props rather than overriding per call site.

---

## 2. Copy — every pt-BR string, verbatim

These go into `pt.json` keyed by their English translation. Punctuation is exact: em dash is U+2014, `·` is U+00B7, `×` is U+00D7, `−` in the stepper is U+2212 (MINUS SIGN, not hyphen), `✕` is U+2715, `←` is U+2190. En dash U+2013 appears only in `Grafite 2H–6B`. **No curly quotes and no ellipsis character anywhere.**

### Header
| pt-BR | English key |
|---|---|
| `est. 2026` | `est. 2026` |
| `Sobre` | `About` |
| `Sacola ({{count}})` | `Bag ({{count}})` |
| `Admin` | — **dropped**, spec:11 (admin is unlinked) |

Everything except the brand is uppercased by CSS. Keep source casing and let `uppercase` do it.

### Home
| pt-BR |
|---|
| `Um portfólio disfarçado de loja` |
| `Coisas que eu` / `faço com as mãos` (em) / `, à venda de verdade.` |
| `Cartas escritas à mão, desenhos, e o que mais eu resolver aprender. Cada compra passa pelo Stripe e chega pelo correio. Sou desenvolvedor — este site também é uma peça do catálogo.` |
| `Ver a peça em destaque` |
| `Envio para todo o Brasil` |
| `Em destaque` |
| `O catálogo inteiro` |
| `{{count}} peças` |
| `Feito por uma pessoa só, do desenho ao checkout.` |
| `Eu escrevo, desenho, embalo e despacho. Também escrevi o carrinho, a integração de pagamento e esta página. Se o que você precisa é a segunda parte, ` + link `me manda uma mensagem` + `.` |

The H1's `<em>` wraps exactly `faço com as mãos`; the comma after it is outside the em.

### Product
| pt-BR |
|---|
| `← Catálogo` |
| `Colocar na sacola` (the planted key `Add to bag`) |
| `Escrito, embalado e despachado por mim, em até 5 dias úteis. Pagamento processado pelo Stripe.` |
| `Detalhe` / `Embalagem` (thumbnail placeholders — replace with real alt text) |
| stock label: `{{count}} em estoque` (planted key `{{count}} in stock`), digital → `download imediato` |

⚠️ The prototype's digital label is `download imediato`. spec:222 overrides it: there is no automatic download, so digital items read **`Delivered by e-mail`**. Use the spec's wording, not the prototype's.

### About
| pt-BR |
|---|
| `Sobre` |
| `Uma loja de quatro peças, ` + `escrita à mão` (em) + ` nos dois sentidos.` |
| `Sou Augusto. Desenvolvedor de dia, e nas horas vagas alguém que escreve cartas, desenha a nanquim e borda marcadores de página. Esta loja existe porque eu queria construir uma loja — e achei mais honesto vender coisas que eu realmente faço.` |
| `01 · Como funciona` / `Você pede, eu faço, o correio entrega.` / `Nada aqui é produzido em lote. Depois do pagamento eu começo a peça, e mando o código de rastreio por e-mail quando despacho. O prazo de cada item está na página dele.` |
| `02 · Materiais` / `Papel de algodão, nanquim, grafite e linha.` / `Uso papel algodão 180g, tinta nanquim preta, lápis grafite 2H a 6B e linha de algodão. É a lista inteira. Quando entrar cerâmica no catálogo, esta lista muda.` |
| `03 · Trocas` / `Se chegar torto, eu faço de novo.` / `Peça danificada no transporte ou fora do que combinamos: me escreve em até sete dias e eu refaço ou devolvo o valor. Encomendas personalizadas passam por uma prévia antes de finalizar.` |
| facts: `4` / `peças no catálogo` · `2026` / `primeira carta enviada` · `5 dias` / `prazo médio de produção` · `1` / `pessoa fazendo tudo` |
| `Se você chegou aqui pelo código, e não pela carta.` |
| `Este site é o portfólio: a vitrine, a página de produto, a sacola, o checkout e a integração de pagamento foram construídos por mim, do zero. O nome é uma piada sobre isso — um portfólio feito à mão, que por acaso também vende coisas feitas à mão.` |
| `Aceito conversas sobre produto, interface e sistemas web. Também aceito encomendas de carta.` |
| `Falar comigo` / `Ver o catálogo` |

Block 2 says `2H a 6B` (the word "a"); the product spec says `Grafite 2H–6B` (en dash). Both are correct as written — do not normalise one to the other.

The About facts are hardcoded in the prototype. `4 peças no catálogo` will go stale the moment a fifth product is added: either derive it from the catalogue or accept it as static copy and say so.

### Cart drawer
| pt-BR |
|---|
| `Sua sacola` |
| `A sacola está vazia.` (planted key `Your bag is empty.`) |
| `Subtotal` / `Frete` / `Total` |
| `Ir para o pagamento` |

The drawer's `Frete` row has no method name; the checkout summary's does (`Frete (Correios PAC)`).

### Checkout
| pt-BR |
|---|
| `← Voltar para a sacola` |
| `Pagamento seguro via Stripe` |
| `Finalizar pedido` |
| `Para onde eu mando, e para quem.` |
| `01 · Quem está comprando` / `02 · Endereço de entrega` / `03 · Envio` / `04 · Sobre o pedido` / `05 · Pagamento` |
| placeholders: `Nome completo` · `E-mail` · `Telefone / WhatsApp` · `CEP` · `Número` · `Complemento` · `Rua / logradouro` · `Bairro` · `Cidade` · `Estado` · `País` |
| `Notas para mim: o assunto da carta, o nome de quem vai receber, prazos, qualquer coisa.` |
| `É presente? Mensagem no cartão` / `Como me encontrou? (opcional)` |
| `Stripe Checkout` |
| `Seu pedido` / `Subtotal` / `Frete ({{method}})` / `Total` |
| `Pagar {{total}}` |
| `Ao continuar você aceita que eu comece a produzir a peça. Prazo de produção conta a partir da confirmação do pagamento.` |

**Two strings must be rewritten, not transcribed:**
- The CPF field (`CPF (para a nota fiscal)`) is **deleted** — spec decision 3. Removing it leaves 3 fields in an `auto-fit minmax(180px,1fr)` grid; check the reflow.
- The payment copy `Cartão, Pix ou boleto na página segura do Stripe. Nada de dado de cartão passa por aqui — você volta para cá com o pedido confirmado.` becomes **card-only** — spec decision 2. The second sentence still holds verbatim.

### Order placed
| pt-BR |
|---|
| `Pedido #MHP-{{number}}` |
| `Pedido feito.` / `Agora é minha vez.` (second line in `<em>`, true italic) |
| `Mandei a confirmação por e-mail, e mando o código de rastreio quando despachar. Se você chegou aqui pelo lado técnico da coisa: este fluxo inteiro é o portfólio.` |
| `Total pago` / `Envio` / `Prazo estimado` |
| `Voltar ao catálogo` |

The prototype's order number is `"0" + (413 + cart.length)` — a display gimmick. Use `formatOrderNumber(n)` from `@shop/shared`.

---

## 3. Structure notes per component

Only what a faithful rebuild cannot infer. Full inline styles are in the prototype at the line ranges given.

### ShopHeader (proto 32–44)
`sticky top-0 z-[5]`, `flex flex-wrap items-baseline justify-between gap-6`, `border-b border-ink bg-paper`, gutter padding + `py-5`, `font-mono text-xs uppercase tracking-[.1em]`. Brand overrides to `font-display text-[22px] tracking-normal normal-case`. `est. 2026` at `opacity-50`. Nav gap is `clamp(14px,3vw,32px)`. The bag link carries `border-b border-ink`. **The opaque `bg-paper` is required, not decorative** — it is the scroll backdrop.

### Hero (proto 46–72) vs About hero (proto 145–160)
They differ and must not share an implementation blindly: hero grid `minmax(320px,1fr)` vs `minmax(300px,1fr)`; `justify-between gap-10` vs `justify-center gap-[22px]`; H1 `clamp(44px,7vw,86px)/.98` vs `clamp(38px,6vw,74px)/1`; image `min-h-[min(66vh,540px)]` vs `min-h-[min(56vh,460px)]`; only the Home hero has the featured card overlay.

⚠️ Both hero left columns carry `border-r border-ink` unconditionally. When `auto-fit` collapses to one column, that becomes a dangling right edge. The prototype does not guard it. Fix it deliberately or reproduce it deliberately — but say which.

### CatalogGrid / ProductCard (proto 79–95)
Grid is `auto-**fill**` at `minmax(240px,1fr)` — the hero and every other grid is `auto-fit`. Not interchangeable; keep as written. Card: `bg-paper px-[18px] pt-[18px] pb-[22px] flex flex-col gap-[14px] hover:bg-paper-2`, image wrapper `relative aspect-[4/5]`, name `font-display text-2xl leading-[1.15]`, meta `mt-[6px] font-mono text-[11px] uppercase tracking-[.12em] opacity-55`, price `whitespace-nowrap font-mono text-sm`.

### ProductGallery (proto 106–120)
Panel is `bg-paper-2`, each frame is `bg-paper` with `border-ink/20` — a lighter card on a darker panel. Main image `aspect-[4/5] max-w-[400px]` and `object-contain`; two thumbs `aspect-square max-w-[140px] flex-1` and `object-cover`. The spec adds selection state (`selectedPhoto`, `onSelectPhoto`) the prototype does not have.

### SpecsTable (proto 128–133)
Hairline grid, `px-[14px] py-[11px] font-mono text-xs tracking-[.04em]`. The **key** carries its own `uppercase` and `opacity-55`; the value is `text-right` at full opacity and keeps its source casing. Build it as `<dl>`/`<dt>`/`<dd>`, which the prototype's divs are not.

### CartDrawer (proto 585–621)
Panel `w-[min(460px,100%)]`, `border-l border-ink bg-paper`, shadow `-24px 0 60px rgba(26,23,19,.18)`, scrim `bg-ink/42`. Header row `px-6 py-5 border-b border-ink`, mono 11px `tracking-[.18em] uppercase`. Line grid is `grid-cols-[72px_1fr_auto] gap-4 px-6 py-5`, divider `border-b border-ink/20`. Thumbnail 72×90 with the name's first character at `opacity-40` — a placeholder, no `<img>`. Stepper is a bordered row of three cells with `border-l`/`border-r` on the middle one; use the PR 2 `Stepper` primitive instead. Footer `border-t border-ink px-6 py-5 gap-[14px] font-mono text-[13px]`; the Total row adds `text-base border-t border-ink/25 pt-[14px]`.

**Empty state:** the prototype still renders the totals footer and an enabled CTA over an empty cart, and the CTA navigates to a checkout with nothing in it. Do not reproduce that. Decide in Task 5: the empty drawer shows the message and no CTA, or a disabled CTA.

**Decrement to zero removes the line.** There is no separate remove affordance. `useCart.setQty(slug, 0)` already does this.

### CheckoutPage (proto 193–303)
Outer grid `auto-fit minmax(320px,1fr) items-start`; left column gutter padding with `gap-[clamp(28px,4vw,44px)]`; summary column `sticky top-20`.

Section header recipe, identical on all five: `font-mono text-[10px] uppercase tracking-[.18em] opacity-55 pb-[10px] border-b border-ink mb-4`.

Field grids: section 01 `auto-fit minmax(180px,1fr) gap-3`; section 02 `auto-fit minmax(150px,1fr) gap-3` with `Rua / logradouro` spanning `grid-column:1/-1`. DOM order in 02 is `CEP, Número, Complemento, Rua, Bairro, Cidade, Estado, País` — street comes fourth.

**Shipping options:** hairline grid; the selected/unselected difference is **only the radio dot** — filled `bg-ink` circle vs `border border-ink/50` ring, both 11px. Nothing else changes: same background, same opacity, same weight. Row hover `bg-paper-2`. Option name overrides to `font-body text-[17px]`; ETA is mono at `opacity-55`; price mono at full opacity.

⚠️ **A selection state signalled by an 11px dot alone is the same class of problem PR 2 fixed three times.** These are `<div onClick>` in the prototype with no `role`, no keyboard handling and no focus indicator. Build them as real `<input type="radio">` with a visible focus ring and a checked state that survives forced-colors; a11y `test: 'error'` will catch the missing name/role, but it will not catch a 3:1 failure on the dot — measure it.

**Payment section** is a static card with a permanently-filled dot: it is not a choice, and must not be built as one.

### OrderSummaryPanel (proto 275–300)
Line meta reads `{{qty}} × {{unit}} · {{type}}` with the type lowercase (`físico` / `digital`). Rows: `Subtotal`, `Frete ({{method}})`, `Total` — the Total row adds `text-[17px] border-t border-ink pt-[14px]`. CTA `Pagar {{total}}` at `py-[17px]`. Shipping shows `—` (U+2014) when there is none.

### DonePage (proto 305–317)
`max-w-[760px] mx-auto`, padding `clamp(48px,9vw,120px)` / gutter, `gap-[22px]`. Headline is a `<div>` in the prototype — **build it as `<h1>`**, since the page has no other heading and axe's `page-has-heading-one` will fire. Three hand-written hairline rows, not a loop. Back link is a `<span onClick>` — build it as an `<a href={routes.home()}>`.

---

## 4. What the design does not give us

Every one of these is a decision the implementer must make and record, not a gap to fill silently.

1. **No mailto anywhere.** `me manda uma mensagem` (Home) and `Falar comigo` (About) are both `href="#"`. The spec supplies the address: `mailto:contato@augustoamaral.com`, built with `routes.mailto()`.
2. **No semantics at all.** No `<button>`, `<a href>`, `<nav>`, `<header>`, `<main>`, `<form>`, `<label>`, no ARIA, no keyboard handling, no focus management. Headings that look like headings are `<div>`s. The rebuild adds all of it — this is the single biggest source of divergence from the prototype, and it is intended.
3. **No error, validation, loading, disabled or empty states** exist anywhere except the empty-bag message. Everything the checkout needs — field errors, submitting, the `OUT_OF_STOCK`/`UNKNOWN_ITEM` recovery — is being designed here, not transcribed. Keep it in the established visual language: mono uppercase labels, 1px rules, accent for the one thing that needs attention.
4. **No `prefers-reduced-motion` handling** for the three animations.
5. **No media queries at all.** The whole responsive behaviour is `auto-fit`/`auto-fill` + `clamp()` + `flex-wrap`. Do not "improve" it into breakpoints.
6. **The About portrait slot is empty** in the design's own state file, and so are the detail thumbs for the default product. spec:219 covers this: a paper-coloured placeholder until real photos exist.
7. **`Foto sua ou da bancada`, `Foto da peça em destaque`, `Detalhe`, `Embalagem`** are editor instructions, not alt text. Real alt text has to be written; `alt` comes from the product data where it exists.
