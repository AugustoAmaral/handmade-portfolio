# PR 4 — Prototype extract, admin (copy, structure, and what the design does not give us)

Companion to `2026-09-10-webshop-v2-04-web-admin.md`. Extracted from `design-claude-design/My Handmade Portfolio.dc.html` (975 lines), which is the approved visual source of truth. Sibling of `2026-09-09-webshop-v2-03-prototype-extract.md`, which covers the shop.

**Read this before building any component in Tasks 2–6.** The plan says what to build and how to test it; this file carries the fidelity. Where the two disagree, the prototype wins on appearance and copy, and the plan wins on semantics and behaviour.

---

## 0. What the prototype actually is — and four corrections to what PR 4's plan assumes

The admin lives in **lines 319–583**, not 319–584. `<sc-if value="{{ isAdmin }}">` opens on 319 and closes on 583; 584 is blank. Inside it, three mutually exclusive branches:

| Branch | Lines | Gate |
|---|---|---|
| products table | 333–383 | `adminList` = `adminView === "products" && !draft` |
| product form | 385–510 | `adminForm` = `!!draft` |
| orders (list + detail together) | 512–581 | `adminOrders` = `adminView === "orders" && !draft` |

The dark bar (321–331) is outside all three and renders for every admin branch. Everything sits inside the app-wide wrapper on line 30, `background:#f4f0e6;color:#1a1713;font-family:Newsreader,Georgia,serif;min-height:100vh` — so **the admin page ground is paper; only the bar is ink.** The shop header (32–44) is a sibling `<sc-if>`, so the admin does not render it.

### Correction 1 — "no semantic HTML" is false for the admin

The shop extract's finding held for the shop. It does **not** hold here. Tag inventory for 319–583:

```
<div> x75   <span> x43   <label> x13   <input> x13   <sc-if> x9   <sc-for> x6
<option> x4   <h1> x3   <select> x2   <textarea> x2   <h2> x1   <image-slot> x1
```

So the admin form already ships **real `<label>` elements wrapping real `<input>`/`<select>`/`<textarea>`** — implicit label association, which is valid. The three `<h1>`s are one per branch (mutually exclusive at runtime, so no duplicate-h1 problem), and the order detail's customer name is a real `<h2>`.

What is still missing, and this is the accurate list: **no `<form>`, no `<button>`, no `<a href>`, no `<nav>`, no `<header>`, no `<main>`, no `<table>`, no `<p>`, no ARIA, no `id`/`htmlFor`, no `type="submit"`.** Every action is a `<span onClick>` (17 of them). Section headings inside a screen ("Português", "English", "Fotos", "Dados · chave e valor", "Entrega", "Itens", "Notas do cliente") are `<div>`s, not `<h3>`s. The address and the customer notes are `<div>`s, not `<p>`s.

**Zero `class` attributes in the file** — confirmed, `grep -c 'class='` returns 0. That part holds. Every Tailwind string below is a derivation.

### Correction 2 — the admin gutter is NOT `--spacing-gutter`

| Value | Occurrences | Where |
|---|---|---|
| `clamp(20px,5vw,64px)` | **9** (33, 70, 92, 101, 145, 160, 179, 195, 306) | shop only — none in the admin |
| `clamp(16px,4vw,40px)` | **7** (321, 335, 345, 350, 387, 395, 514) | admin only |
| `clamp(16px,4vw,32px)` | **1** (521) | admin orders-list rows only |

`--spacing-gutter` in `apps/web/src/index.css` is the shop value, and its comment says "appears verbatim six times" — the real count is nine. Neither number covers the admin. **Decide in Task 2:** add `--spacing-gutter-admin: clamp(16px, 4vw, 40px)`, or normalise the admin to the shop gutter on purpose. Do not inline the raw clamp seven times, and do not silently reuse `px-gutter` — it is 24px wider at the top end and the products table's six-column grid is already tight at `min-width:900px`.

The `clamp(16px,4vw,32px)` on the orders row is a third value used once, for the narrower left column. `px-gutter-admin` is close enough there; note the 8px difference if you collapse them.

### Correction 3 — `∞` marks DIGITAL, not made-to-order

Line 892: `stock: it.type === "digital" ? "∞" : it.stock`. The one `∞` (U+221E) in the whole file belongs to the digital PDF, whose real `stock` is `999`. `retrato-lapis` is the made-to-order item (`sub: "A4 · sob encomenda"`) and it renders its literal stock, `2`. If the real build wants `∞` for made-to-order, that is a new rule, not a transcription.

### Correction 4 — the products table has SIX columns, not five

The plan's screen summary omits **Idiomas**, the i18n-completeness column (lines 355–362). It is the only place in the whole design where accent is used as a *status* colour rather than a hover, and it is the reason the form header carries its "both languages are mandatory" note. Do not drop it by accident.

### Template attributes

`<sc-if value="{{ x }}">`, `<sc-for list="{{ xs }}" as="i">`, `style-hover="…"` (7 in the admin), `onClick="{{ handler }}"` (17), `onChange="{{ … }}"` (17), `<image-slot id shape fit placeholder>` (1). Data is a `<script type="text/x-dc">` block (626–973) holding `SEED`, `ORDERS`, `SHIP`, `brl()`, `emptyDraft()` and `renderVals()`.

### `hint-placeholder-count` vs. the real counts

Editor stubs. Four of the six are wrong.

| `sc-for` | Line | Hint | **Real** | Source |
|---|---|---|---|---|
| `adminItems` | 349 | 4 | **5** | `SEED.length` — 4 active + `guia-nanquim-pdf` inactive |
| `photoRows` | 454 | 3 | **1** | no `SEED` item has a `photos` key; line 901 falls back to `[{altPt:"",altEn:""}]`, and `emptyDraft()` also gives 1 |
| `specRows` | 485 | 3 | **4** for the four physical items, **3** for `guia`, **1** for a new draft |
| `orders` | 520 | 4 | **4** ✔ the only correct hint |
| `order.contact` | 542 | 3 | **4** — E-mail, Telefone, CPF, Como me achou |
| `order.items` | 559 | 2 | **1 or 2** — 2, 1, 2, 1 across the four orders |

**`photoRows` is the one that matters.** The prototype has never rendered more than one photo card, so the multi-photo grid (`repeat(auto-fill,minmax(230px,1fr))`) has never been seen at more than one column. `PhotosEditor` is being designed, not transcribed.

---

## 1. Token mapping — every colour and font in the admin

### Colours, exhaustive for lines 319–583

| Raw | Count | Token | Where (lines) |
|---|---|---|---|
| `#1a1713` | 26 | `ink` | dark bar bg (321); every 1px rule; filled pills (340, 502, 575); Ativo chip (368); hairline-grid bg (541) |
| `#a63d20` | 10 | `accent` | pill hovers (340, 502, 575); product-name hover (352); i18n warning (360); Apagar (375); ✕ remove (458, 495); Apagar este produto (505) |
| `#f4f0e6` | 6 | `paper` | dark-bar text (321); text on every filled pill (340, 502, 575); Ativo chip text (368); hairline-grid cells (543) |
| `#efe9db` | 2 | `paper-2` | photo slot ground (460); orders-row hover (521) |
| `#e6dfcd` | 2 | `paper-3` | outline-pill hover (503, 576) |
| `rgba(244,240,230,.35)` | 2 | `paper/35` | **paper-on-ink** — nav underlines in the dark bar (327, 328) |
| `rgba(26,23,19,.2)` | 2 | `ink/20` | product-row bottom rule (350); order-row bottom rule (521) |
| `rgba(26,23,19,.25)` | 1 | `ink/25` | PT↔EN divider in a spec row (491) |
| `rgba(26,23,19,.3)` | 1 | `ink/30` | order-total top rule (565) |
| `rgba(26,23,19,.4)` | 1 | `ink/40` | Inativo chip border (371) |

**Nothing is off-palette.** Unlike the shop (`#e9e2d1`, used once), the admin uses only the five `@theme` colours and alpha derivatives of two of them. No new token is needed for colour.

### Fonts

`'IBM Plex Mono',monospace` x41 → `font-mono`. `'Instrument Serif',serif` x8 → `font-display`. **`Newsreader` never appears in the admin range** — the order address (552), the order notes (571) and nothing else inherit it from the line-30 wrapper. In the rebuild that inheritance will not exist; set `font-body` explicitly on those two, or they will render mono.

`∞` (U+221E) at 13px in IBM Plex Mono: the face covers it, but if the webfont fails the fallback stack is bare `monospace`. Worth a `font-mono` fallback that names a real family, or a non-glyph alternative.

---

## 2. The dark bar — the contrast direction inverts

This is the one place on the project where paper sits on ink, and every ratio intuition built on the shop is backwards here. Measured (WCAG 2.x relative luminance, alpha composited against the actual background):

### Raw values in the bar, all of them

| Line | Declaration | Composited | Ratio vs `#1a1713` | Verdict |
|---|---|---|---|---|
| 321 | `background:#1a1713;color:#f4f0e6` | — | **15.69:1** | pass, and identical to ink-on-paper — the palette is symmetric at full opacity |
| 323 | brand, no opacity | `#f4f0e6` | 15.69:1 | pass |
| 324 | `opacity:.5` ("Painel") | `rgb(135,132,124)` | **4.78:1** | **passes** AA for 11px text |
| 327, 328 | `border-bottom:1px solid rgba(244,240,230,.35)` | `rgb(102,99,93)` | **2.98:1** | **fails 1.4.11 by 0.02** |
| 329 | `opacity:.6` ("Ver a loja ↗") | `rgb(157,153,146)` | **6.30:1** | pass |

### Why this matters — the same numbers on paper

| Opacity | On ink (admin bar) | On paper (everywhere else) |
|---|---|---|
| `.35` | 2.98:1 | 2.18:1 |
| `.45` | 4.11:1 | 2.86:1 |
| `.5` | **4.78:1 ✔** | 3.28:1 ✘ |
| `.55` | 5.48:1 ✔ | 3.82:1 ✘ |
| `.6` | 6.30:1 ✔ | 4.47:1 ✘ (marginal) |
| `.65` | 7.19:1 ✔ | **5.26:1 ✔** |
| `.7` | 8.17:1 | 6.23:1 ✔ |
| `.75` | 9.23:1 | 7.39:1 ✔ |

**PR 2's rule — "below `opacity-65`, muted text on paper does not clear 4.5:1" — does not apply inside the dark bar.** On ink, `.5` already clears it. If you apply the paper rule reflexively you will lighten "Painel" and "Ver a loja" for no reason and flatten the bar's hierarchy. Conversely, `FieldLabel`'s multiply-through warning (`opacity-70` inside `opacity-75` → 3.54:1) is a paper calculation and stays a paper calculation.

**Flag for measurement, not assumption:** any story or axe run that renders `AdminHeader` must set the ink background on the story canvas. A paper-backgrounded story will report the bar's own text as failing and the underline as passing — both wrong.

### The one real failure in the bar

`rgba(244,240,230,.35)` = **2.98:1** against ink, where 1.4.11 wants 3:1 for a graphical object that conveys state. Two mitigations, and the choice should be recorded:

- It is arguably decorative: the underline does not distinguish link from non-link, because "Ver a loja ↗" is equally clickable and has **no** underline while "Painel" is not clickable and also has none. As a link affordance it is already inconsistent.
- Once these become real `<a>`/`<button>` elements with a visible focus ring, the underline is pure decoration and 2.98 is moot.

Cheapest honest fix if you keep it as an affordance: `rgba(244,240,230,.4)` → 3.36:1. Do not "fix" it by leaving it and calling 2.98 close enough.

### Paper-on-ink outside the bar

Three filled pills and one chip put `#f4f0e6` on `#1a1713` (15.69:1) and hover to `#f4f0e6` on `#a63d20` — **5.58:1**, which passes AA for the 10–12px text they carry but is the tightest ratio in the design. Same number as the shop's accent-on-paper, since the pair is symmetric.

### Contrast audit of the paper part of the admin

Every muted value below sits on `#f4f0e6` (or `#efe9db` on hover) and is therefore governed by the right-hand column of the table above:

| Ratio | Lines | Content | Verdict |
|---|---|---|---|
| `opacity:.5` → 3.28:1 | 345 | **table column headers** (Produto / Idiomas / Preço / Estoque / Tipo / Situação) | ✘ |
| `opacity:.5` → 3.28:1 | 353 | `{{ it.nameEn }} · {{ it.slug }}` sub-line | ✘ |
| `opacity:.55` → 3.82:1 | 338, 389, 392, 516, 530, 536, 544, 551, 557, 570 | `adminSummary`, `formTag`, the form's helper note, `ordersSummary`, `itemsLabel · status`, `code · date`, contact keys, every section eyebrow | ✘ (10 sites) |
| `opacity:.6` → 4.47:1 | 357, 371, 456, 479, 522, 553 | `PT ✓ EN ✓`, the Inativo chip, photo-card header, spec column headers, order code/date row, shipping line | ✘ by 0.03 |
| `opacity:.6` on `#efe9db` → 4.38:1 | 522 while row is hovered | order code/date | ✘, and worse on hover |
| `opacity:.7` → 6.23:1 | 365 | `typeLabel` | ✔ |
| `opacity:.75` → 7.39:1 | 398, 401, 404, 407, 413, 424, 427, 430, 436, 439, 442, 463, 466 | all 13 form labels | ✔ — matches `FieldLabel` exactly |
| `opacity:.85` → 10.26:1 | 552, 571 | address, notes | ✔ |
| accent on paper → 5.58:1 | 352, 360, 375, 458, 495, 505 | hover, i18n warning, Apagar, ✕ | ✔ |

**Non-text:** `ink/20` = 1.52:1, `ink/25` = 1.70:1, `ink/30` = 1.92:1, `ink/40` = 2.49:1. All below 3:1, all used as dividers or as the Inativo chip's border. Dividers are decorative and exempt. **The Inativo chip's border is not** — it is the shape that makes the chip read as a chip. And because `opacity:.6` sits on the same element, that border composites to an effective 0.24 alpha = **1.67:1**. `StatusPill` already solved this class of problem (`pending: 'border border-ink/40 opacity-70'`, plus a *dashed* border to carry a distinction that opacity could not) — reuse it rather than re-deriving.

Existing `StatusPill` tones map onto the admin cleanly: Ativo → the `paid` tone (`bg-ink text-paper`), Inativo → the `pending` tone (`border border-ink/40 opacity-70`). One caveat: `StatusPill` takes an `OrderStatus`, and Ativo/Inativo is a *product* state. Either widen it or write a sibling; do not pass a fake status through it.

---

## 3. Copy — every pt-BR string, verbatim

Punctuation is exact. Codepoints where confusion is possible: `·` **U+00B7** MIDDLE DOT (7 in markup, 8 in the orders fixture), `×` **U+00D7** MULTIPLICATION SIGN (once, line 562), `✕` **U+2715** MULTIPLICATION X (twice, lines 458 and 495 — *not* U+00D7, *not* `✖`), `✓` **U+2713** CHECK MARK (twice, line 357), `↗` **U+2197** NORTH EAST ARROW (once, line 329), `—` **U+2014** EM DASH (5 in addresses, 2 in the EN-missing fallback), `∞` **U+221E** INFINITY (once, line 892). **No en dash U+2013, no minus U+2212, no curly quotes, no ellipsis character anywhere in the admin.** `&nbsp;` appears once as an HTML entity (line 357).

### 3.1 Dark bar

| pt-BR | Note |
|---|---|
| `{{ shopName }}` | prop, default `My Handmade Portfolio` |
| `Painel` | static, not a link |
| `Produtos` | → `goAdminProducts` |
| `Pedidos` | → `goAdminOrders` |
| `Ver a loja ↗` | → `goHome`; the arrow is **U+2197**, separated by one regular space |

Everything except the brand is uppercased by CSS (`text-transform:uppercase` on line 321). Keep source casing and let `uppercase` do it. The brand overrides with `text-transform:none`.

### 3.2 Products table

| pt-BR | Note |
|---|---|
| `Produtos` | h1 |
| `+ Novo produto` | `+` is plain U+002B, one space |
| `Produto` `Idiomas` `Preço` `Estoque` `Tipo` `Situação` | the six column headers |
| `PT ✓ &nbsp; EN ✓` | i18n-complete; literally `PT ✓`, `&nbsp;` between two regular spaces, `EN ✓` |
| `EN incompleto` | `it.en.name` present but a description missing |
| `EN faltando` | `it.en.name` absent |
| `Ativo` / `Inativo` | the toggle chip, both `onClick={it.toggle}` |
| `Editar` / `Apagar` | |
| `Físico` / `Digital` | `typeLabel` |
| `— sem versão EN —` | `nameEn` fallback; **em dashes U+2014**, one space inside each |
| `∞` | `stock` when `type === "digital"` |

**Derived, computed exactly:**

- `adminSummary` = `5 cadastrados · 4 ativos · 1 digitais` — note **"1 digitais"**, a plural with a count of one. The template is `n + " digitais"` with no singular branch, same for `cadastrados`/`ativos`. Fix it in the rebuild or reproduce the bug knowingly.
- `brl(n)` = `"R$ " + n.toFixed(2).replace(".", ",")` → `R$ 45,00`. **No thousands separator** — a 1200-real product renders `R$ 1200,00`. `formatBRL` in `@shop/shared` is the right source; check it agrees or decide which wins.

**The five rows, verbatim, in DOM order:**

| namePt | nameEn | slug | preço | estoque | tipo | situação | specs |
|---|---|---|---|---|---|---|---|
| `Carta escrita à mão` | `Handwritten letter` | `carta-escrita` | `R$ 45,00` | `12` | `Físico` | `Ativo` | 4 |
| `Desenho a nanquim` | `India ink drawing` | `desenho-nanquim` | `R$ 120,00` | `4` | `Físico` | `Ativo` | 4 |
| `Retrato a lápis` | `Pencil portrait` | `retrato-lapis` | `R$ 180,00` | `2` | `Físico` | `Ativo` | 4 |
| `Marcador bordado` | `Embroidered bookmark` | `marcador-bordado` | `R$ 25,00` | `20` | `Físico` | `Ativo` | 4 |
| `Guia de nanquim (PDF)` | `India ink guide (PDF)` | `guia-nanquim-pdf` | `R$ 18,00` | `∞` | `Digital` | `Inativo` | 3 |

All five have complete PT and EN, so **`i18nMissing` never fires in the fixture** — the accent `EN incompleto` / `EN faltando` state has never been rendered. It is a designed-but-unexercised state; give it a story.

### 3.3 Product form

| pt-BR | Where |
|---|---|
| `Novo cadastro` | `formTag` when creating |
| `Editando · {{ slug }}` | `formTag` when editing — `·` U+00B7 |
| `Cadastrar produto` | `formTitle` when creating |
| `{{ draft.pt.name }}` or `Sem nome` | `formTitle` when editing with an empty PT name |
| `Os dois idiomas são obrigatórios. A loja mostra PT; a versão EN é usada na tradução do site.` | the header note, `max-width:34ch`, right-aligned |
| `Identificador` | label — **not** "Slug" |
| `Preço (R$)` | label |
| `Estoque` | label |
| `Tipo` | label; options `Físico` (value `fisico`) / `Digital` (value `digital`) |
| `Situação` | label; options `Ativo na loja` (value `sim`) / `Desabilitado` (value `nao`) |
| `Português` / `English` | the two column headings |
| `Nome` / `Subdescrição` / `Descrição` | PT column labels |
| `Name` / `Subtitle` / `Description` | EN column labels |
| `Fotos` | section heading |
| `+ Adicionar foto` | |
| `Foto principal` | `photoRows[0].label` |
| `Foto 2`, `Foto 3`, … | `"Foto " + (i + 1)` for i > 0 |
| `Alt (PT)` / `Alt (EN)` | per-photo labels |
| `✕` | per-photo remove (U+2715) |
| `Dados · chave e valor` | specs section heading — `·` U+00B7 |
| `+ Adicionar linha` | |
| `Português` / `English` | specs column headings, repeated |
| `✕` | per-row remove (U+2715) |
| `Salvar produto` | |
| `Cancelar` | |
| `Apagar este produto` | only when `formEditing` |

**Placeholders, all ten, exact:**

| Field | Placeholder |
|---|---|
| Identificador | `carta-escrita` |
| Subdescrição (PT) | `Papel algodão · 2 folhas` (U+00B7) |
| Subtitle (EN) | `Cotton paper · 2 sheets` (U+00B7) |
| photo slot | `Arraste a foto` (an `<image-slot placeholder>`, not an input) |
| Alt (PT) | `Descrição da imagem` |
| Alt (EN) | `Image description` |
| spec key PT | `Chave` |
| spec value PT | `Valor` |
| spec key EN | `Key` |
| spec value EN | `Value` |

Preço, Estoque, Nome, Name, Descrição and Description have **no placeholder**.

⚠️ **Three words for two states.** The table says `Ativo` / `Inativo`; the form's select says `Ativo na loja` / `Desabilitado`. Pick one vocabulary. `Ativo` / `Inativo` is the one that appears more often and is shorter in a chip.

⚠️ **The PT/EN column labels are an i18n key collision.** `Nome` and `Name` are not translations of each other — they are two different fields whose labels happen to be written in the language of the column. Under the plan's rule (English-sentence keys, one copy instance, no admin language toggle) both would key to `Name`, and rendering the admin in English would label both columns "Name". Same for `Subdescrição`/`Subtitle`, `Descrição`/`Description`, `Chave`/`Key`, `Valor`/`Value`. `Alt (PT)` / `Alt (EN)` already shows the fix — disambiguate in the key. Decide this in Task 4, before `copy.test.ts` locks the keys in.

### 3.4 Orders list

| pt-BR |
|---|
| `Pedidos` (h1) |
| `{{ o.code }}` · `{{ o.date }}` · `{{ o.customer }}` · `{{ o.totalLabel }}` |
| `{{ o.itemsLabel }} · {{ o.status }}` — `·` U+00B7 with a space each side |

`ordersSummary` = `4 pedidos · 2 em aberto` (`ORDERS.filter(o => o.status !== "Despachado").length`).

`itemsLabel` = `o.items.reduce((t,[,q]) => t+q, 0) + " itens"` — **`1 itens`** for order #MHP-0411. Same missing singular branch as `adminSummary`.

**The four rows, computed:**

| code | date | customer | total | itemsLabel | status |
|---|---|---|---|---|---|
| `#MHP-0412` | `05 set 2026` | `Marina Bicalho` | `R$ 95,00` | `3 itens` | `Em produção` |
| `#MHP-0411` | `03 set 2026` | `Rafael Andrade` | `R$ 180,00` | `1 itens` | `Aguardando pagamento` |
| `#MHP-0410` | `28 ago 2026` | `Júlia Ferreira` | `R$ 165,00` | `2 itens` | `Despachado` |
| `#MHP-0409` | `24 ago 2026` | `Bruno Tavares` | `R$ 75,00` | `3 itens` | `Despachado` |

Date format is `DD mmm YYYY` with a lowercase three-letter pt-BR month and **no trailing period** (`set`, `ago`).

Only three of the five `OrderStatus` values appear: `Aguardando pagamento` (pending), `Em produção` (paid), `Despachado` (shipped). **`oversold` and `expired` are never drawn** — `STATUS_LABELS` in `StatusPill` already carries `Insufficient stock` and `Expired`, and the admin will render statuses the design never showed. Also note the design does not put statuses in a pill at all here: they are plain mono text at `opacity:.55` appended after a `·`.

### 3.5 Order detail

| pt-BR |
|---|
| `{{ order.code }} · {{ order.date }}` |
| `{{ order.customer }}` (h2) |
| `{{ order.status }} · {{ order.payment }}` |
| `E-mail` / `Telefone` / `CPF` / `Como me achou` (the four contact keys) |
| `Entrega` (section heading) |
| `Itens` (section heading) |
| `Total` |
| `Notas do cliente` (section heading) |
| `Marcar como despachado` |
| `Responder por e-mail` |
| item line: `{{ i.qty }} × {{ i.unitLabel }}` — `×` **U+00D7**, spaces both sides |

**Order #MHP-0412 in full (the default, `state.order = 0`):**

```
code      #MHP-0412
date      05 set 2026
customer  Marina Bicalho
status    Em produção
payment   Stripe · cartão
contact   E-mail        marina.b@gmail.com
          Telefone      +55 31 98812-4407
          CPF           042.118.***-**
          Como me achou Twitter
address   Rua Sapucaí, 388, ap. 51 — Floresta, Belo Horizonte / MG, 30150-904, Brasil
shipping  Correios SEDEX · previsão 12 set
items     Carta escrita à mão   1 × R$ 45,00
          Marcador bordado      2 × R$ 25,00
total     R$ 95,00
notes     A carta é para minha avó, aniversário de 80 anos. Ela gosta de flores e de reclamar
          do trânsito. Se puder mencionar as duas coisas, ótimo.
```

The address's `—` is **U+2014**, one space each side, separating street-and-number from neighbourhood. All four addresses follow the same shape and all four use U+2014.

The other three `shipping` strings, verbatim:

```
Correios PAC · previsão 18 set
Correios SEDEX · rastreio BR8841200SC
Correios PAC · rastreio BR7719044RJ
```

So `shipping` is **one opaque string** that switches vocabulary — `previsão <date>` before dispatch, `rastreio <code>` after. It is not two fields. The real model has a method and a nullable tracking code, and `TrackingInlineForm` has to render into a slot the design draws as prose.

### 3.6 ⚠️ Pix, boleto and CPF — where the removed vocabulary lives

Spec decision 2 made the real build **card-only**; the shop extract already caught the checkout copy. In the admin the vocabulary survives in the fixture, at these exact places:

| Line | Order | String |
|---|---|---|
| 685 | #MHP-0412 | `payment: "Stripe · cartão"` — the only one that survives the decision |
| **691** | **#MHP-0411** | **`payment: "Stripe · boleto"`** |
| **697** | **#MHP-0410** | **`payment: "Stripe · Pix"`** |
| 703 | #MHP-0409 | `payment: "Stripe · cartão"` |

Rendered at line 538: `{{ order.status }} · {{ order.payment }}`.

**Drop these deliberately.** Two of the four fixture orders carry a payment method the shop can no longer produce. If they are copied into `src/fixtures/` unchanged, the admin's stories and e2e will assert on a method the checkout cannot create. Either make all four `Stripe · cartão`, or drop the `payment` half of that line entirely — it says "Stripe" and "cartão" for every order that will ever exist, which is not information.

**CPF is the same story, and the plan does not mention it.** Spec decision 3 deleted the CPF field from checkout. But `contact` carries `["CPF", "042.118.***-**"]` in all four orders (lines 686, 692, 698, 704) and it renders as the third of four contact rows in the detail panel. **A field that is never collected cannot be displayed.** Drop the row; the contact list becomes three rows (E-mail, Telefone, Como me achou), and the `hint-placeholder-count="3"` on line 542 becomes accidentally correct.

`Como me achou` maps to the checkout's `Como me encontrou? (opcional)` — an optional field, so the row must tolerate an empty value. The design never draws that.

---

## 4. Structure and styles, screen by screen

**Transcription vs. derivation is separated in every block below.** The fenced `html` block is the file, character for character. The table under it is my derivation and has to be checked against it.

### 4.1 Admin header (lines 321–331)

**Transcription:**

```html
<div style="display:flex;justify-content:space-between;align-items:center;gap:20px;padding:14px clamp(16px,4vw,40px);background:#1a1713;color:#f4f0e6;flex-wrap:wrap;font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;position:sticky;top:0;z-index:5">
  <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap">
    <span style="font-family:'Instrument Serif',serif;font-size:19px;letter-spacing:0;text-transform:none">{{ shopName }}</span>
    <span style="opacity:.5">Painel</span>
  </div>
  <div style="display:flex;gap:clamp(14px,3vw,26px);align-items:center">
    <span style="cursor:pointer;border-bottom:1px solid rgba(244,240,230,.35)" onClick="{{ goAdminProducts }}">Produtos</span>
    <span style="cursor:pointer;border-bottom:1px solid rgba(244,240,230,.35)" onClick="{{ goAdminOrders }}">Pedidos</span>
    <span style="cursor:pointer;opacity:.6" onClick="{{ goHome }}">Ver a loja ↗</span>
  </div>
</div>
```

**Derivation:**

| Element | Tailwind 4 |
|---|---|
| bar | `sticky top-0 z-[5] flex flex-wrap items-center justify-between gap-5 bg-ink px-[clamp(16px,4vw,40px)] py-3.5 font-mono text-[11px] tracking-[0.14em] text-paper uppercase` |
| brand group | `flex flex-wrap items-center gap-5` |
| brand | `font-display text-[19px] tracking-normal normal-case` |
| `Painel` | `opacity-50` |
| nav group | `flex items-center gap-[clamp(14px,3vw,26px)]` |
| Produtos / Pedidos | `border-b border-paper/35` → real `<a>`/`<button>` |
| Ver a loja ↗ | `opacity-60` → real `<a href={routes.home()}>` |

Notes: the bar is `items-center`, the shop header is `items-baseline` — do not share. `bg-ink` is opaque and load-bearing (it is the sticky scroll backdrop), same as the shop's `bg-paper`. The shop header is 20px/12px/`.1em`; the admin bar is 14px/11px/`.14em`. Brand 22px vs 19px. They are deliberately different sizes; do not unify.

The bar has no `<nav>`, no landmark, no current-page state — nothing marks whether you are on Produtos or Pedidos. `aria-current="page"` and a visible active treatment are both additions.

### 4.2 Products table (lines 334–382)

**Transcription — header band, scroll wrapper, column head:**

```html
<div style="padding:clamp(26px,4vw,44px) clamp(16px,4vw,40px) 20px;display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;border-bottom:1px solid #1a1713">
  <div>
    <h1 style="font-family:'Instrument Serif',serif;font-weight:400;font-size:clamp(30px,4vw,48px);line-height:1;margin:0">Produtos</h1>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.55;margin-top:10px">{{ adminSummary }}</div>
  </div>
  <span style="background:#1a1713;color:#f4f0e6;padding:14px 26px;border-radius:999px;cursor:pointer;font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase" style-hover="background:#a63d20" onClick="{{ newItem }}">+ Novo produto</span>
</div>

<div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
<div style="min-width:900px">
<div style="display:grid;grid-template-columns:minmax(220px,2fr) minmax(150px,1fr) 110px 90px 120px 130px;gap:16px;padding:12px clamp(16px,4vw,40px);font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;opacity:.5;border-bottom:1px solid #1a1713">
  <span>Produto</span><span>Idiomas</span><span>Preço</span><span>Estoque</span><span>Tipo</span><span>Situação</span>
</div>
```

**Transcription — one row. It repeats via `<sc-for list="{{ adminItems }}" as="it" hint-placeholder-count="4">`; the real count is 5.**

```html
<div style="display:grid;grid-template-columns:minmax(220px,2fr) minmax(150px,1fr) 110px 90px 120px 130px;gap:16px;padding:18px clamp(16px,4vw,40px);border-bottom:1px solid rgba(26,23,19,.2);align-items:center;font-family:'IBM Plex Mono',monospace;font-size:13px">
  <div style="min-width:0">
    <div style="font-family:'Instrument Serif',serif;font-size:22px;line-height:1.15;cursor:pointer" style-hover="color:#a63d20" onClick="{{ it.edit }}">{{ it.namePt }}</div>
    <div style="font-size:11px;opacity:.5;margin-top:4px">{{ it.nameEn }} · {{ it.slug }}</div>
  </div>
  <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase">
    <sc-if value="{{ it.i18nOk }}" hint-placeholder-val="{{ true }}">
      <span style="opacity:.6">PT ✓ &nbsp; EN ✓</span>
    </sc-if>
    <sc-if value="{{ it.i18nMissing }}" hint-placeholder-val="{{ false }}">
      <span style="color:#a63d20">{{ it.i18nLabel }}</span>
    </sc-if>
  </div>
  <div>{{ it.priceLabel }}</div>
  <div>{{ it.stock }}</div>
  <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.7">{{ it.typeLabel }}</div>
  <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-start">
    <sc-if value="{{ it.active }}" hint-placeholder-val="{{ true }}">
      <span style="background:#1a1713;color:#f4f0e6;padding:5px 12px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;cursor:pointer" onClick="{{ it.toggle }}">Ativo</span>
    </sc-if>
    <sc-if value="{{ it.inactive }}" hint-placeholder-val="{{ false }}">
      <span style="border:1px solid rgba(26,23,19,.4);padding:4px 11px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;opacity:.6;cursor:pointer" onClick="{{ it.toggle }}">Inativo</span>
    </sc-if>
    <div style="display:flex;gap:10px;font-size:11px;letter-spacing:.06em;text-transform:uppercase">
      <span style="cursor:pointer;border-bottom:1px solid #1a1713" onClick="{{ it.edit }}">Editar</span>
      <span style="cursor:pointer;color:#a63d20" onClick="{{ it.remove }}">Apagar</span>
    </div>
  </div>
</div>
```

**Derivation:**

| Element | Tailwind 4 |
|---|---|
| header band | `flex flex-wrap items-end justify-between gap-5 border-b border-ink px-[clamp(16px,4vw,40px)] pt-[clamp(26px,4vw,44px)] pb-5` |
| h1 | `font-display text-[clamp(30px,4vw,48px)] leading-none font-normal m-0` |
| summary | `font-mono mt-2.5 text-[11px] tracking-[0.14em] uppercase opacity-55` |
| + Novo produto | `PillButton` `variant="solid"` — the raw is `px-[26px] py-3.5`, `PillButton`'s `default` size is `px-7 py-3.5` (28px vs 26px). Take the primitive. |
| scroll wrapper | `overflow-x-auto` (drop `-webkit-overflow-scrolling`, obsolete) |
| inner | `min-w-[900px]` |
| grid (head and row share it) | `grid grid-cols-[minmax(220px,2fr)_minmax(150px,1fr)_110px_90px_120px_130px] gap-4` |
| column head | `px-[clamp(16px,4vw,40px)] py-3 font-mono text-[10px] tracking-[0.16em] uppercase opacity-50 border-b border-ink` |
| row | `items-center border-b border-ink/20 px-[clamp(16px,4vw,40px)] py-[18px] font-mono text-[13px]` |
| name cell | `min-w-0` |
| name | `font-display text-[22px] leading-[1.15] hover:text-accent` |
| sub-line | `mt-1 text-[11px] opacity-50` |
| Idiomas cell | `text-[11px] tracking-[0.1em] uppercase` |
| `PT ✓ EN ✓` | `opacity-60` |
| i18n warning | `text-accent` |
| typeLabel | `text-[11px] tracking-[0.08em] uppercase opacity-70` |
| situação cell | `flex flex-col items-start gap-2` |
| Ativo chip | `bg-ink text-paper px-3 py-[5px] text-[10px] tracking-[0.12em] uppercase` |
| Inativo chip | `border border-ink/40 px-[11px] py-1 text-[10px] tracking-[0.12em] uppercase opacity-60` |
| actions row | `flex gap-2.5 text-[11px] tracking-[0.06em] uppercase` |
| Editar | `border-b border-ink` |
| Apagar | `text-accent` |

**A CSS grid is not a table.** Build it as `<table>` / `<thead>` / `<tbody>` / `<tr>` / `<th scope="col">` / `<td>` with `display:grid` applied to the rows, or accept `role="table"` scaffolding. Six unlabelled `<div>`s in a grid announce as nothing. axe will not flag it (it is not a broken table, it is no table), so this is a decision, not a test failure waiting to happen.

**The two chips differ by 1px of padding** (`5px 12px` filled vs `4px 11px` outlined) so the 1px border keeps the outer box identical. Reproduce or reconcile, but if you drop the compensation the row jitters on toggle.

**The whole row has three separate hit targets** (name → edit, chip → toggle, Editar/Apagar) inside a grid cell that is itself not focusable. Keyboard order after the rebuild will be name, chip, Editar, Apagar — four tab stops per row, 20 for the fixture. Worth a deliberate decision.

### 4.3 Product form (lines 386–509)

**Transcription — header:**

```html
<div style="animation:riseIn .25s ease both">
  <div style="padding:clamp(26px,4vw,44px) clamp(16px,4vw,40px) 20px;border-bottom:1px solid #1a1713;display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap">
    <div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;opacity:.55;margin-bottom:10px">{{ formTag }}</div>
      <h1 style="font-family:'Instrument Serif',serif;font-weight:400;font-size:clamp(30px,4vw,48px);line-height:1;margin:0">{{ formTitle }}</h1>
    </div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.55;max-width:34ch;text-align:right">Os dois idiomas são obrigatórios. A loja mostra PT; a versão EN é usada na tradução do site.</div>
  </div>

  <div style="padding:clamp(24px,4vw,44px) clamp(16px,4vw,40px);display:flex;flex-direction:column;gap:clamp(26px,4vw,40px);max-width:1180px">
```

**Transcription — identifiers row (5 fields, one grid). One label shown; all five share the same label style string.**

```html
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px">
  <label style="display:flex;flex-direction:column;gap:8px;font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;opacity:.75">Identificador
    <input value="{{ f.slug.value }}" onChange="{{ f.slug.onChange }}" placeholder="carta-escrita">
  </label>
  <label style="…same…">Preço (R$)
    <input type="number" value="{{ f.price.value }}" onChange="{{ f.price.onChange }}">
  </label>
  <label style="…same…">Estoque
    <input type="number" value="{{ f.stock.value }}" onChange="{{ f.stock.onChange }}">
  </label>
  <label style="…same…">Tipo
    <select value="{{ f.type.value }}" onChange="{{ f.type.onChange }}">
      <option value="fisico">Físico</option>
      <option value="digital">Digital</option>
    </select>
  </label>
  <label style="…same…">Situação
    <select value="{{ f.active.value }}" onChange="{{ f.active.onChange }}">
      <option value="sim">Ativo na loja</option>
      <option value="nao">Desabilitado</option>
    </select>
  </label>
</div>
```

The label style string, verbatim, used **13 times** (lines 398, 401, 404, 407, 413, 424, 427, 430, 436, 439, 442, and — with `gap:7px` instead of `gap:8px` — 463, 466):

```
display:flex;flex-direction:column;gap:8px;font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;opacity:.75
```

**Derivation:** this is `FieldLabel` exactly — `font-mono flex flex-col gap-2 text-[10px] uppercase tracking-[0.16em] opacity-75`. Use the primitive; the only difference in the photo cards is `gap-[7px]`, which is not worth a variant.

Inputs and selects carry no inline style at all — they inherit the global stylesheet (see §5). Use `TextInput` / `Select` / `TextArea` from PR 2 instead, which already replace `outline:none` + hue-shift with the measured 2px accent ring.

**Transcription — PT/EN columns:**

```html
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:clamp(20px,3vw,36px)">
  <div style="display:flex;flex-direction:column;gap:16px">
    <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;padding-bottom:10px;border-bottom:1px solid #1a1713">Português</div>
    <label …>Nome<input value="{{ f.namePt.value }}" onChange="{{ f.namePt.onChange }}"></label>
    <label …>Subdescrição<input value="{{ f.subPt.value }}" onChange="{{ f.subPt.onChange }}" placeholder="Papel algodão · 2 folhas"></label>
    <label …>Descrição<textarea rows="6" value="{{ f.descPt.value }}" onChange="{{ f.descPt.onChange }}"></textarea></label>
  </div>
  <div style="display:flex;flex-direction:column;gap:16px">
    <div style="…same heading…">English</div>
    <label …>Name<input value="{{ f.nameEn.value }}" onChange="{{ f.nameEn.onChange }}"></label>
    <label …>Subtitle<input value="{{ f.subEn.value }}" onChange="{{ f.subEn.onChange }}" placeholder="Cotton paper · 2 sheets"></label>
    <label …>Description<textarea rows="6" value="{{ f.descEn.value }}" onChange="{{ f.descEn.onChange }}"></textarea></label>
  </div>
</div>
```

The section-heading style string appears **4 times** (423, 435, and inside the two section headers at 449, 475):

```
font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;padding-bottom:10px;border-bottom:1px solid #1a1713
```

**Derivation:** `Eyebrow` is `font-mono text-[11px] uppercase tracking-[0.18em] opacity-65` — same type, but the prototype's heading has **no opacity** and adds `pb-2.5 border-b border-ink`. Either extend `Eyebrow` with a `ruled` prop or write a local `SectionRule`. Do not add `opacity-65` to match `Eyebrow` — these headings are full-strength on purpose.

**Transcription — photos section. One card shown; it repeats via `<sc-for list="{{ photoRows }}" as="ph" hint-placeholder-count="3">`; the real count is 1.**

```html
<div>
  <div style="display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap;font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;padding-bottom:10px;border-bottom:1px solid #1a1713;margin-bottom:18px">
    <span>Fotos</span>
    <span style="cursor:pointer;border-bottom:1px solid #1a1713;letter-spacing:.08em" onClick="{{ addPhoto }}">+ Adicionar foto</span>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:clamp(14px,2vw,22px)">
    <sc-for list="{{ photoRows }}" as="ph" hint-placeholder-count="3">
      <div style="border:1px solid #1a1713;padding:14px;display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;opacity:.6">
          <span>{{ ph.label }}</span>
          <span style="cursor:pointer;color:#a63d20;opacity:1;font-size:13px" onClick="{{ ph.remove }}">✕</span>
        </div>
        <div style="position:relative;width:100%;aspect-ratio:4/5;background:#efe9db">
          <image-slot id="{{ ph.slotId }}" shape="rect" fit="cover" placeholder="Arraste a foto"></image-slot>
        </div>
        <label style="display:flex;flex-direction:column;gap:7px;…opacity:.75">Alt (PT)
          <input value="{{ ph.altPt.value }}" onChange="{{ ph.altPt.onChange }}" placeholder="Descrição da imagem">
        </label>
        <label style="…gap:7px…">Alt (EN)
          <input value="{{ ph.altEn.value }}" onChange="{{ ph.altEn.onChange }}" placeholder="Image description">
        </label>
      </div>
    </sc-for>
  </div>
</div>
```

**Derivation:**

| Element | Tailwind 4 |
|---|---|
| section header | `mb-[18px] flex flex-wrap items-baseline justify-between gap-4 border-b border-ink pb-2.5 font-mono text-[11px] tracking-[0.18em] uppercase` |
| `+ Adicionar foto` | `border-b border-ink tracking-[0.08em]` → `<button type="button">` |
| grid | `grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-[clamp(14px,2vw,22px)]` — **auto-fill**, matching `CatalogGrid`, not `auto-fit` |
| card | `flex flex-col gap-3 border border-ink p-3.5` |
| card head | `flex items-center justify-between font-mono text-[10px] tracking-[0.16em] uppercase opacity-60` |
| ✕ | `text-accent text-[13px] opacity-100` — the `opacity:1` deliberately cancels the parent `.6` |
| slot | `relative aspect-[4/5] w-full bg-paper-2` → `ImageFrame` |
| alt labels | `FieldLabel` with `gap-[7px]` |

`<image-slot>` is a Claude Design editor custom element, not a file input. **There is no upload control drawn anywhere** — no `<input type="file">`, no drop zone chrome beyond the word `Arraste a foto`, no progress, no thumbnail-after-upload state. `PhotosEditor` invents all of it.

**Transcription — specs section. One row shown; it repeats via `<sc-for list="{{ specRows }}" as="r" hint-placeholder-count="3">`; the real count is 4 (3 for `guia`, 1 for a new draft).**

```html
<div>
  <div style="display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap;font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;padding-bottom:10px;border-bottom:1px solid #1a1713;margin-bottom:16px">
    <span>Dados · chave e valor</span>
    <span style="cursor:pointer;border-bottom:1px solid #1a1713;letter-spacing:.08em" onClick="{{ addSpec }}">+ Adicionar linha</span>
  </div>
  <div style="display:flex;gap:clamp(16px,3vw,36px);flex-wrap:wrap;font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;opacity:.6;margin-bottom:12px">
    <span style="flex:1;min-width:240px">Português</span>
    <span style="flex:1;min-width:240px">English</span>
    <span style="width:20px"></span>
  </div>
  <div style="display:flex;flex-direction:column;gap:12px">
    <sc-for list="{{ specRows }}" as="r" hint-placeholder-count="3">
      <div style="display:flex;gap:clamp(16px,3vw,36px);flex-wrap:wrap;align-items:center">
        <div style="flex:1;min-width:240px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <input value="{{ r.kPt.value }}" onChange="{{ r.kPt.onChange }}" placeholder="Chave">
          <input value="{{ r.vPt.value }}" onChange="{{ r.vPt.onChange }}" placeholder="Valor">
        </div>
        <div style="flex:1;min-width:240px;display:grid;grid-template-columns:1fr 1fr;gap:10px;border-left:1px solid rgba(26,23,19,.25);padding-left:clamp(12px,2vw,24px)">
          <input value="{{ r.kEn.value }}" onChange="{{ r.kEn.onChange }}" placeholder="Key">
          <input value="{{ r.vEn.value }}" onChange="{{ r.vEn.onChange }}" placeholder="Value">
        </div>
        <span style="width:20px;text-align:center;cursor:pointer;font-size:14px;color:#a63d20" onClick="{{ r.remove }}">✕</span>
      </div>
    </sc-for>
  </div>
</div>
```

**Derivation:** column heads `flex flex-wrap gap-[clamp(16px,3vw,36px)] font-mono text-[10px] tracking-[0.16em] uppercase opacity-60 mb-3`, each `flex-1 min-w-[240px]` plus a `w-5` spacer aligning with the ✕. Row `flex flex-wrap items-center gap-[clamp(16px,3vw,36px)]`; each half `flex-1 min-w-[240px] grid grid-cols-2 gap-2.5`; the EN half adds `border-l border-ink/25 pl-[clamp(12px,2vw,24px)]`; ✕ `w-5 text-center text-sm text-accent`.

⚠️ **The four spec inputs have no labels.** Only placeholders (`Chave`/`Valor`/`Key`/`Value`), and the column headings are `<span>`s with no programmatic relationship. That is an axe `label` violation four times per row — 16 on a four-spec product. `aria-label` per input, keyed off the row index, or visually hidden `<label>`s. This is the single densest a11y gap in the admin.

⚠️ The `w-5` spacer column aligns the ✕ only while the row does not wrap. Below ~530px the two halves wrap and the ✕ lands under them; the design does not address it.

**Transcription — action bar:**

```html
<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;border-top:1px solid #1a1713;padding-top:24px;font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase">
  <span style="background:#1a1713;color:#f4f0e6;padding:15px 30px;border-radius:999px;cursor:pointer" style-hover="background:#a63d20" onClick="{{ saveDraft }}">Salvar produto</span>
  <span style="border:1px solid #1a1713;padding:15px 30px;border-radius:999px;cursor:pointer" style-hover="background:#e6dfcd" onClick="{{ cancelDraft }}">Cancelar</span>
  <sc-if value="{{ formEditing }}" hint-placeholder-val="{{ false }}">
    <span style="cursor:pointer;color:#a63d20;margin-left:auto;border-bottom:1px solid #a63d20" onClick="{{ removeDraft }}">Apagar este produto</span>
  </sc-if>
</div>
```

**Derivation:** bar `flex flex-wrap items-center gap-3.5 border-t border-ink pt-6 font-mono text-xs tracking-[0.1em] uppercase`. Salvar → `PillButton variant="solid"`, Cancelar → `PillButton variant="outline"`, both `px-[30px] py-[15px]` raw vs the primitive's `px-7 py-3.5` — take the primitive. Apagar → `ml-auto border-b border-accent text-accent`, pushed to the far right by `margin-left:auto`, and **present only when editing**.

There is no `<form>` and no `type="submit"`. `PillButton` already supports `type="submit"` and a `form` id — wrap the fields in a real `<form id>` so Enter submits and the browser's own validation can run.

### 4.4 Orders list + detail (lines 513–580)

They are **one screen**: a two-column `auto-fit` grid, list on the left, detail on the right, both always rendered.

**Transcription — header and layout:**

```html
<div style="animation:riseIn .25s ease both">
  <div style="padding:clamp(26px,4vw,44px) clamp(16px,4vw,40px) 20px;border-bottom:1px solid #1a1713">
    <h1 style="font-family:'Instrument Serif',serif;font-weight:400;font-size:clamp(30px,4vw,48px);line-height:1;margin:0">Pedidos</h1>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.55;margin-top:10px">{{ ordersSummary }}</div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
    <div style="border-right:1px solid #1a1713">
      … list …
    </div>
    <div style="padding:clamp(24px,4vw,40px);display:flex;flex-direction:column;gap:26px">
      … detail …
    </div>
  </div>
</div>
```

**Transcription — one order row. It repeats via `<sc-for list="{{ orders }}" as="o" hint-placeholder-count="4">`; the real count is 4.**

```html
<div style="padding:18px clamp(16px,4vw,32px);border-bottom:1px solid rgba(26,23,19,.2);cursor:pointer;display:flex;flex-direction:column;gap:8px" style-hover="background:#efe9db" onClick="{{ o.select }}">
  <div style="display:flex;justify-content:space-between;gap:14px;font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.6">
    <span>{{ o.code }}</span>
    <span>{{ o.date }}</span>
  </div>
  <div style="display:flex;justify-content:space-between;gap:14px;align-items:baseline">
    <span style="font-family:'Instrument Serif',serif;font-size:22px;line-height:1.15">{{ o.customer }}</span>
    <span style="font-family:'IBM Plex Mono',monospace;font-size:14px;white-space:nowrap">{{ o.totalLabel }}</span>
  </div>
  <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.55">{{ o.itemsLabel }} · {{ o.status }}</div>
</div>
```

**Derivation:** row `flex cursor-pointer flex-col gap-2 border-b border-ink/20 px-[clamp(16px,4vw,32px)] py-[18px] hover:bg-paper-2`; meta row `flex justify-between gap-3.5 font-mono text-[11px] tracking-[0.12em] uppercase opacity-60`; name row `flex items-baseline justify-between gap-3.5` with `font-display text-[22px] leading-[1.15]` and `font-mono text-sm whitespace-nowrap`; footer `font-mono text-[11px] tracking-[0.08em] uppercase opacity-55`.

**Transcription — detail panel, all five blocks. The contact row repeats (`hint-placeholder-count="3"`, real 4); the item row repeats (`hint-placeholder-count="2"`, real 1–2).**

```html
<div>
  <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;opacity:.55">{{ order.code }} · {{ order.date }}</div>
  <h2 style="font-family:'Instrument Serif',serif;font-weight:400;font-size:clamp(28px,3.4vw,40px);line-height:1.05;margin:10px 0 0">{{ order.customer }}</h2>
  <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.06em;margin-top:10px">{{ order.status }} · {{ order.payment }}</div>
</div>

<div style="display:flex;flex-direction:column;gap:1px;background:#1a1713;border:1px solid #1a1713;font-family:'IBM Plex Mono',monospace;font-size:12px">
  <sc-for list="{{ order.contact }}" as="c" hint-placeholder-count="3">
    <div style="background:#f4f0e6;padding:12px 14px;display:flex;justify-content:space-between;gap:16px">
      <span style="opacity:.55;text-transform:uppercase;letter-spacing:.1em">{{ c.k }}</span>
      <span style="text-align:right">{{ c.v }}</span>
    </div>
  </sc-for>
</div>

<div>
  <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;opacity:.55;padding-bottom:10px;border-bottom:1px solid #1a1713;margin-bottom:14px">Entrega</div>
  <div style="font-size:17px;line-height:1.55;opacity:.85;text-wrap:pretty">{{ order.address }}</div>
  <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;margin-top:10px;opacity:.6">{{ order.shipping }}</div>
</div>

<div>
  <div style="…same eyebrow…">Itens</div>
  <div style="display:flex;flex-direction:column;gap:10px">
    <sc-for list="{{ order.items }}" as="i" hint-placeholder-count="2">
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:baseline">
        <span style="font-family:'Instrument Serif',serif;font-size:20px">{{ i.name }}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:13px;white-space:nowrap">{{ i.qty }} × {{ i.unitLabel }}</span>
      </div>
    </sc-for>
    <div style="display:flex;justify-content:space-between;border-top:1px solid rgba(26,23,19,.3);padding-top:12px;font-family:'IBM Plex Mono',monospace;font-size:15px"><span>Total</span><span>{{ order.totalLabel }}</span></div>
  </div>
</div>

<div>
  <div style="…same eyebrow…">Notas do cliente</div>
  <div style="font-size:17px;line-height:1.6;opacity:.85;text-wrap:pretty">{{ order.notes }}</div>
</div>

<div style="display:flex;gap:12px;flex-wrap:wrap;font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase">
  <span style="background:#1a1713;color:#f4f0e6;padding:13px 24px;border-radius:999px;cursor:pointer" style-hover="background:#a63d20">Marcar como despachado</span>
  <span style="border:1px solid #1a1713;padding:13px 24px;border-radius:999px;cursor:pointer" style-hover="background:#e6dfcd">Responder por e-mail</span>
</div>
```

The detail eyebrow style string, verbatim, used **3 times** (551, 557, 570) — note it is 10px/`.16em`/`opacity:.55`, a *different* recipe from the form's 11px/`.18em`/full-strength heading:

```
font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;opacity:.55;padding-bottom:10px;border-bottom:1px solid #1a1713;margin-bottom:14px
```

It **is** the shop's checkout section-header recipe (`text-[10px] uppercase tracking-[0.18em] opacity-55 pb-2.5 border-b border-ink`) except the tracking is `.16em`, not `.18em`, and the bottom margin is 14px, not 16px. Reconcile with `CheckoutSection` rather than writing a third variant.

**Derivation:**

| Element | Tailwind 4 |
|---|---|
| panel | `flex flex-col gap-[26px] p-[clamp(24px,4vw,40px)]` |
| code · date | `font-mono text-[11px] tracking-[0.16em] uppercase opacity-55` |
| customer h2 | `font-display mt-2.5 text-[clamp(28px,3.4vw,40px)] leading-[1.05] font-normal` |
| status · payment | `font-mono mt-2.5 text-xs tracking-[0.06em]` |
| contact list | `RuledList` — the raw is `flex flex-col gap-px bg-ink border border-ink`, which is `RuledList` verbatim |
| contact row | `RuledRow` is `bg-paper px-4 py-3.5`; the raw is `px-3.5 py-3` (14/12 vs 16/14). Take the primitive, note the 2px. |
| contact key | `uppercase tracking-[0.1em] opacity-55` |
| contact value | `text-right` |
| address | `text-[17px] leading-[1.55] opacity-85 text-pretty` + **`font-body` explicitly** |
| shipping | `font-mono mt-2.5 text-xs opacity-60` |
| item row | `flex items-baseline justify-between gap-4`, name `font-display text-xl`, qty `font-mono text-[13px] whitespace-nowrap` |
| total row | `flex justify-between border-t border-ink/30 pt-3 font-mono text-[15px]` |
| notes | `text-[17px] leading-[1.6] opacity-85 text-pretty` + **`font-body` explicitly** |
| CTA bar | `flex flex-wrap gap-3 font-mono text-[11px] tracking-[0.1em] uppercase`, both `px-6 py-[13px]` → `PillButton` solid / outline |

⚠️ **Both CTAs have no `onClick`.** They are the only two `style-hover` elements in the admin with no handler. `Marcar como despachado` does nothing and `Responder por e-mail` has no address behind it — the exact shape of the shop extract's finding 1 (`me manda uma mensagem` and `Falar comigo` both `href="#"`). Use `routes.mailto()` with the order's own e-mail for the second, and the dispatch mutation for the first.

⚠️ **`border-right:1px solid #1a1713` on the list column is unconditional.** When `auto-fit` collapses to one column below 640px, that becomes a dangling right edge — the same bug as both shop heroes, and it goes unguarded here too. Fix it deliberately or reproduce it deliberately, but say which.

⚠️ **No selected state.** `o.select` sets `state.order`, and nothing in the row's styling reads it. All four rows look identical whether selected or not; only hover distinguishes anything. On a collapsed one-column layout the detail sits below all four rows, so clicking a row changes content the user cannot see without scrolling. `aria-current`, a visible selected treatment and a focus move are all additions.

---

## 5. The global stylesheet — what the admin inherits

Unchanged from the shop extract (lines 16–27), and the admin form is its heaviest consumer: **13 inputs, 2 selects and 2 textareas with no inline style of their own.**

```css
input, button, select, textarea { font: inherit; color: inherit; }
input, select, textarea { background: transparent; border: 1px solid #1a1713; padding: 12px 13px; font-family: 'IBM Plex Mono', monospace; font-size: 13px; outline: none; width: 100%; box-sizing: border-box; border-radius: 0; }
input:focus, select:focus, textarea:focus { border-color: #a63d20; }
textarea { resize: vertical; line-height: 1.5; }
```

**Already rejected.** `outline:none` plus a focus border hue change measures 2.81:1 where WCAG 2.2 wants 3:1, and signals focus by hue alone. PR 2 replaced it with a 2px accent outline at 2px offset and `TextInput.stories.tsx` measures it. Do not reintroduce it here; use `TextInput` / `TextArea` / `Select`.

`animation:riseIn .25s ease both` appears twice in the admin (386, 513) — the form and the orders screen, **not** the products table. `@keyframes riseIn` must be in `index.css` if kept, and it has no `prefers-reduced-motion` guard. Note the admin's `.25s` vs the shop's `.3s`.

---

## 6. What the design does not give us

Every one of these is a decision the implementer must make and record, not a gap to fill silently. The shop's list (no semantics, no error/loading/empty states, no contact address) all reappears; these are the admin-specific ones.

### 6.1 No login screen, at all

Search the entire 975-line file for `senha`, `login`, `token`, `entrar`, `sair`, `logout`, `autenticar`, `password`: **zero hits.** `goAdmin` on line 880 flips `mode` to `"admin"` with no gate. The plan's `LoginCard`, `AdminLoginPage` and `useAdminSession` have **no visual precedent whatsoever** — not a field, not a button, not an error message, not a logged-out state, and no way to log out from the bar. This is the largest single invention in PR 4, and the bar's own vocabulary is the only style reference: mono 11px, `.14em`, paper on ink.

### 6.2 No confirmation before destructive actions

Three destructive controls, three bare `onClick`s that fire immediately:

| Control | Line | Handler | Effect |
|---|---|---|---|
| `Apagar` (table row) | 375 | `it.remove` | `items.filter(x => x.id !== it.id)` — instant, no prompt |
| `Apagar este produto` (form) | 505 | `removeDraft` | same, plus closes the form |
| `✕` (photo card) | 458 | `ph.remove` | `photos.filter((_, n) => n !== i)` — instant |
| `✕` (spec row) | 495 | `r.remove` | `specs.filter((_, n) => n !== i)` — instant |

No modal, no undo, no "are you sure", no toast, no disabled-while-pending. The plan already flags this as risk #3; the design confirms there is nothing to transcribe. Accent colour is the *only* signal that these differ from `Editar`, and accent is also the hover colour of every pill — it is not a reserved danger colour in this system.

Note also that **`Cancelar` discards an edited draft with no confirmation either**, and it is styled as a neutral outline pill.

### 6.3 No validation and no error display anywhere

`save()` (785–798) is the whole validation story:

```js
id: d.id || d.slug || "item-" + Date.now(),
slug: d.slug || "sem-identificador",
price: Number(d.price) || 0, stock: Number(d.stock) || 0,
```

- An empty Identificador silently becomes the literal slug **`sem-identificador`**. No error, no field highlight.
- A non-numeric price silently becomes `0`. Same for stock.
- **No uniqueness check.** A new draft whose slug matches an existing product's `id` still goes through `items.concat`, producing two rows with the same id — and `toggle`/`remove` then act on both.
- The `Preço (R$)` and `Estoque` inputs are `type="number"` with **no `min`, no `step`, no `inputMode`**. Negative prices and fractional stock are accepted.
- The form's own header says *"Os dois idiomas são obrigatórios"* and then does not enforce it — a product saved with an empty `en.name` just gets `— sem versão EN —` in the table. The rule exists in the copy and nowhere in the behaviour.

There is no error text style, no invalid-field style, no error summary, no `aria-invalid`, no `aria-describedby`. All of it is being designed in Task 4/5, not transcribed. Keep it in the established language: mono uppercase, 1px rules, accent for the one thing that needs attention.

**Units question the design settles ambiguously:** price is a plain number in reais (`45`), and `brl()` divides by nothing. If the API stores cents, the form's `type="number"` field and its `R$` label are a conversion boundary the design does not draw.

### 6.4 No loading, saving or pending states

Nothing in the admin is async in the prototype — every handler is a synchronous `setState`. So there is no spinner, no skeleton, no "Salvando…", no optimistic row, no disabled-while-in-flight, no retry, no network-error surface. Five things in the real build are async and have no drawn state: the products query, the orders query, save, delete, and the photo upload (which is also the slowest and the only one with a progress story worth telling).

### 6.5 No empty states

- **No products:** the table renders its six column headers and then nothing. There is no "nenhum produto ainda" and no call to action beyond the `+ Novo produto` in the band above.
- **No orders:** worse — the list column renders empty *and the detail panel still renders*, bound to `ORDERS[s.order] || ORDERS[0]`, which is `undefined` when `ORDERS` is empty. `renderVals()` would throw on `ord.code`. The design has no defence.
- **No photos:** `photoRows` can be emptied to zero by clicking ✕ on the only card. The grid then renders nothing and the only way back is `+ Adicionar foto`. Not an error, but not drawn either.
- **No specs:** same — ✕ the last row and the section is an empty heading.
- **Empty per-field:** `formTitle` has a fallback (`Sem nome`) and `nameEn` has one (`— sem versão EN —`). Those two are the entire empty-value vocabulary in the admin, and they are the model for the rest.

### 6.6 No disabled state

No control in the admin range is ever disabled, greyed, or non-interactive. There is no `disabled` attribute, no `pointer-events:none`, no reduced-opacity control. `PillButton`'s existing treatment (`pointer-events-none opacity-50`, plus dropping to a real `<button disabled>` rather than a dead anchor) is the only reference, and note that `opacity-50` on ink over paper is **3.28:1** — fine for a control that is deliberately unavailable, but do not reuse that number for anything that must stay readable.

Specifically undrawn: `Salvar produto` while saving, `Marcar como despachado` on an already-dispatched order (two of the four fixture orders are `Despachado` and the button looks identical), and `+ Adicionar foto` at whatever the photo limit is.

### 6.7 Things the design assumes exist but never draws

1. **A file upload.** `<image-slot placeholder="Arraste a foto">` is an editor affordance. No `<input type="file">`, no drop target, no accepted-types hint, no size limit, no upload progress, no failure state, no way to reorder photos, no "principal" toggle (the label is positional — index 0 is `Foto principal`, so reordering *is* the way to change the main photo, and reordering is not drawn).
2. **A tracking-code entry.** `TrackingInlineForm` is in the plan; the design has only the baked string `Correios SEDEX · rastreio BR8841200SC`. No field, no label, no carrier picker, no validation.
3. **Pagination or filtering.** Five products and four orders, hardcoded. No search, no filter by status, no sort, no page control. `min-width:900px` + horizontal scroll is the entire strategy for a table that grows.
4. **A "back to admin" path.** `Ver a loja ↗` calls `goHome`, which sets `mode: "shop"` — and since spec:11 unlinks the admin, once you leave there is no way back except typing the URL. The bar draws a one-way door.
5. **Any current-page indicator.** `Produtos` and `Pedidos` are identically styled regardless of which is showing.
6. **Any resolution of the two singular/plural bugs.** `1 digitais` and `1 itens` render as written.
7. **Statuses `oversold` and `expired`.** Present in `STATUS_LABELS`, absent from the design.
8. **`Como me achou` empty.** The checkout field is optional; the contact row is unconditional.
9. **Any responsive treatment beyond `auto-fit`/`auto-fill`/`clamp()`/`flex-wrap`.** **Zero media queries in the entire file** — that holds for the admin too. Do not "improve" it into breakpoints.
10. **`prefers-reduced-motion`** for the two `riseIn` animations.

### 6.8 Semantics, restated accurately for the admin

Present: `<label>` (13, all wrapping their control), `<input>`, `<select>`, `<option>`, `<textarea>`, `<h1>` (3, mutually exclusive), `<h2>` (1).

Absent and to be added: `<form>` + `id` + `type="submit"`, `<button>` for all 17 `onClick` spans, `<a href>` for `Ver a loja`, `<nav>` around the bar links, `<header>`/`<main>` landmarks, `<table>` semantics for the products grid, `<dl>` for the contact rows, `<h3>` for the seven in-screen section headings, labels for the four spec inputs, `aria-current` on the active nav item, `aria-live` for save/delete results, and focus management when the form opens and closes.

---

## Appendix — repeated-item counts at a glance

| Repeat | Line | Hint | Real | Fixture note |
|---|---|---|---|---|
| product row | 349 | 4 | **5** | 4 active + `guia-nanquim-pdf` inactive |
| photo card | 454 | 3 | **1** | no `SEED` item has `photos`; falls back to one empty card |
| spec row | 485 | 3 | **4** / 3 / 1 | 4 for physical items, 3 for `guia`, 1 for `emptyDraft()` |
| order row | 520 | 4 | **4** | the only correct hint |
| contact row | 542 | 3 | **4** | becomes 3 once CPF is dropped |
| order item row | 559 | 2 | **1–2** | 2, 1, 2, 1 across the four orders |
