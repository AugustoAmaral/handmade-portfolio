import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Button, Card, Field, Input } from '../../components/ui'
import { api } from '../../lib/api'

export function AdminLogin() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const { token } = await api<{ token: string }>('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      localStorage.setItem('shop_admin_token', token)
      navigate('/admin/products')
    } catch {
      setError(t('admin.invalidCredentials'))
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <Card>
        <h1 className="mb-4 font-serif text-xl font-bold">{t('admin.loginTitle')}</h1>
        <form onSubmit={submit} className="space-y-4">
          <Field label={t('admin.email')} htmlFor="email">
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label={t('admin.password')} htmlFor="password">
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full">{t('admin.signIn')}</Button>
        </form>
      </Card>
    </div>
  )
}
