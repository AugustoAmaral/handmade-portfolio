import type { ProductInput, PublicProduct } from '@shop/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Field, Input } from '../../components/ui'
import { ApiError, api } from '../../lib/api'

interface Props {
  initial?: PublicProduct
  onSaved(): void
  onCancel(): void
}

export function ProductForm({ initial, onSaved, onCancel }: Props) {
  const { t } = useTranslation()
  const [form, setForm] = useState<ProductInput>({
    slug: initial?.slug ?? '',
    name: initial?.name ?? { pt: '', en: '' },
    description: initial?.description ?? { pt: '', en: '' },
    priceCents: initial?.priceCents ?? 1000,
    type: initial?.type ?? 'physical',
    stock: initial?.stock ?? null,
    active: initial?.active ?? true,
  })
  const [error, setError] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      if (initial) await api(`/api/admin/products/${initial.id}`, { method: 'PUT', body: JSON.stringify(form) })
      else await api('/api/admin/products', { method: 'POST', body: JSON.stringify(form) })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed')
    }
  }

  async function uploadPhoto(file: File) {
    if (!initial) return
    const fd = new FormData()
    fd.append('photo', file)
    await api(`/api/admin/products/${initial.id}/photos`, { method: 'POST', body: fd })
    onSaved()
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <Field label="Slug" htmlFor="slug">
        <Input id="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
      </Field>
      {(['pt', 'en'] as const).map((l) => (
        <Field key={l} label={`${t('admin.name')} (${l})`} htmlFor={`name-${l}`}>
          <Input id={`name-${l}`} value={form.name[l]} onChange={(e) => setForm({ ...form, name: { ...form.name, [l]: e.target.value } })} />
        </Field>
      ))}
      {(['pt', 'en'] as const).map((l) => (
        <Field key={l} label={`${t('admin.description')} (${l})`} htmlFor={`desc-${l}`}>
          <textarea
            id={`desc-${l}`}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            rows={3}
            value={form.description[l]}
            onChange={(e) => setForm({ ...form, description: { ...form.description, [l]: e.target.value } })}
          />
        </Field>
      ))}
      <Field label={t('admin.priceCents')} htmlFor="price">
        <Input id="price" type="number" value={form.priceCents} onChange={(e) => setForm({ ...form, priceCents: Number(e.target.value) })} />
      </Field>
      <div className="flex items-center gap-6 text-sm">
        <label className="flex items-center gap-2">
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'physical' | 'digital' })} className="rounded-md border border-stone-300 px-2 py-1">
            <option value="physical">physical</option>
            <option value="digital">digital</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.stock === null} onChange={(e) => setForm({ ...form, stock: e.target.checked ? null : 1 })} />
          {t('admin.madeToOrder')}
        </label>
        {form.stock !== null && (
          <Input type="number" className="w-20" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} aria-label={t('admin.stock')} />
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          {t('admin.active')}
        </label>
      </div>
      {initial && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('admin.photos')}</p>
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
          <div className="flex gap-2">
            {initial.photos.map((p) => (
              <div key={p.url} className="relative">
                <img src={p.url} alt="" className="h-16 w-16 rounded object-cover" />
                <button
                  type="button"
                  className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1 text-xs text-white"
                  onClick={async () => {
                    const key = new URL(p.url).pathname.slice(1)
                    await api(`/api/admin/products/${initial.id}/photos?key=${encodeURIComponent(key)}`, { method: 'DELETE' })
                    onSaved()
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit">{t('admin.save')}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>{t('admin.cancel')}</Button>
      </div>
    </form>
  )
}
