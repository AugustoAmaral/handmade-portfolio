import { Route, Routes } from 'react-router'
import { Layout } from './components/Layout'

const Placeholder = ({ name }: { name: string }) => <p>{name}</p>

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Placeholder name="storefront" />} />
        <Route path="/exhibit/:slug" element={<Placeholder name="product" />} />
        <Route path="/cart" element={<Placeholder name="cart" />} />
        <Route path="/thanks" element={<Placeholder name="thanks" />} />
        <Route path="/about" element={<Placeholder name="about" />} />
      </Route>
      <Route path="/admin" element={<Placeholder name="admin-login" />} />
      <Route path="/admin/products" element={<Placeholder name="admin-products" />} />
      <Route path="/admin/orders" element={<Placeholder name="admin-orders" />} />
    </Routes>
  )
}
