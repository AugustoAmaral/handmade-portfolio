export function LangToggle({ lang, onToggle }: { lang: 'pt' | 'en'; onToggle: () => void }) {
  const next = lang === 'pt' ? 'en' : 'pt'
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${next.toUpperCase()}`}
      className="font-mono text-[12px] uppercase tracking-[0.1em] underline underline-offset-4"
    >
      {next}
    </button>
  )
}
