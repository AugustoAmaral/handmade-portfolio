import type { PublicProduct } from '@shop/shared'
import { useTranslation } from 'react-i18next'

export interface SpecsTableProps {
  specs: PublicProduct['specs']
  lang: 'pt' | 'en'
}

/**
 * The product's key/value rows, as a real description list.
 *
 * A `<dl>` COSTS NOTHING AND SAYS EVERYTHING. The prototype builds these out of `<div>`s holding
 * two `<span>`s, which is a table read aloud as one long run of unrelated words: "Formato A5, 2
 * folhas Papel Algodão 180g Prazo 5 dias úteis". `<dt>`/`<dd>` pairs each key to its value in the
 * accessibility tree for free. The one thing it constrains is the markup between them — axe's
 * `definition-list` rule allows a `<dl>` only `<dt>`, `<dd>`, `<div>`, `<script>` and `<template>`
 * as direct children — and the design happens to want exactly a `<div>` per row anyway: the
 * hairline grid puts one 1px rule BETWEEN specs and none between a key and its value, so key and
 * value share a cell rather than sitting in two.
 *
 * THE KEY IS UPPERCASED BY CSS, not by JavaScript. `text-transform` leaves `textContent` as it was
 * written, so the value that reaches a screen reader, a translation memory and `getByText` is the
 * one the catalogue holds. The value keeps its source casing on screen too — `Grafite 2H–6B` and
 * `A4, 21 × 29,7 cm` are the shapes those strings are supposed to have.
 *
 * OPACITY-65, NOT THE PROTOTYPE'S .55. Ink at 55% over paper measures 3.82:1 and this text is 12px,
 * where the floor is 4.5:1; 65% measures 5.26:1. That is the third such fix on this branch and the
 * numbers have been the same every time.
 *
 * THE EMPTY CASE SAYS SO. `digitalLetter` ships with no specs and the design has no state for it.
 * An empty `<dl>` announces a list with nothing in it, which describes a table that failed to load
 * rather than a piece with nothing to tabulate — the same reason `CatalogGrid` does not render an
 * empty `<ul>`. Nothing enforces that: axe's `definition-list` rule was expected to fail a `<dl>`
 * holding no `<dt>`/`<dd>` group and MEASURED SILENT on one, so this is a judgement, not a gate.
 * Rendering `null` was the other candidate and it pushes the same decision onto every page that
 * composes this one. The sentence stays in the table's own voice — mono, 12px, muted — instead of
 * the display-face treatment `CartDrawer` and `CatalogGrid` give an empty region, because this is a
 * block inside a page, not the region itself.
 */
export function SpecsTable({ specs, lang }: SpecsTableProps) {
  const { t } = useTranslation()
  if (specs.length === 0) {
    return <p className="font-mono text-xs tracking-[0.04em] opacity-65">{t('No specs listed for this piece.')}</p>
  }
  return (
    <dl className="bg-ink border-ink flex flex-col gap-px border">
      {specs.map((spec, index) => (
        <div
          key={index}
          className="bg-paper font-mono flex justify-between gap-4 px-[14px] py-[11px] text-xs tracking-[0.04em]"
        >
          <dt className="uppercase opacity-65">{spec.key[lang]}</dt>
          <dd className="text-right">{spec.value[lang]}</dd>
        </div>
      ))}
    </dl>
  )
}
