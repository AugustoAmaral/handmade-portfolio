import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useNavigate } from 'react-router'

export function AdminLayout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  useEffect(() => {
    if (!localStorage.getItem('shop_admin_token')) navigate('/admin')
  }, [navigate])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <nav className="mb-6 flex items-center gap-4 border-b border-stone-200 pb-3 text-sm">
        <span className="font-bold">{t('admin.title')}</span>
        <Link to="/admin/products">{t('admin.products')}</Link>
        <Link to="/admin/orders">{t('admin.orders')}</Link>
        <button
          className="ml-auto underline"
          onClick={() => {
            localStorage.removeItem('shop_admin_token')
            navigate('/admin')
          }}
        >
          {t('admin.logout')}
        </button>
      </nav>
      <Outlet />
    </div>
  )
}
