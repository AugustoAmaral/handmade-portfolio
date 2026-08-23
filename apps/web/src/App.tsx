import { Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { AboutPage } from './pages/AboutPage'
import { CartPage } from './pages/CartPage'
import { ProductPage } from './pages/ProductPage'
import { Storefront } from './pages/Storefront'
import { ThanksPage } from './pages/ThanksPage'

const Placeholder = ({ name }: { name: string }) => <p>{name}</p>

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Storefront />} />
        <Route path="/exhibit/:slug" element={<ProductPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/thanks" element={<ThanksPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Route>
      <Route path="/admin" element={<Placeholder name="admin-login" />} />
      <Route path="/admin/products" element={<Placeholder name="admin-products" />} />
      <Route path="/admin/orders" element={<Placeholder name="admin-orders" />} />
    </Routes>
  )
}
