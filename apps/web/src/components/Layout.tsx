import { Link, Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import { LanguageToggle } from './LanguageToggle'

export function Layout() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link to="/" className="font-serif text-lg font-bold">{t('brand')}</Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/">{t('nav.shop')}</Link>
            <Link to="/about">{t('nav.about')}</Link>
            <Link to="/cart">{t('nav.cart')}</Link>
            <LanguageToggle />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
