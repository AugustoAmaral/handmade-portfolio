import { Navigate, Route, Routes } from 'react-router'
import { AdminShellContainer } from './app/AdminShellContainer'
import { LinkInterceptor } from './app/LinkInterceptor'
import { ShopShellContainer } from './app/ShopShellContainer'
import { AboutRoute } from './app/routes/AboutRoute'
import { CheckoutRoute } from './app/routes/CheckoutRoute'
import { DoneRoute } from './app/routes/DoneRoute'
import { HomeRoute } from './app/routes/HomeRoute'
import { ProductRoute } from './app/routes/ProductRoute'
import { OrdersRoute } from './app/routes/admin/OrdersRoute'
import { ProductFormRoute } from './app/routes/admin/ProductFormRoute'
import { ProductsRoute } from './app/routes/admin/ProductsRoute'
import { routes } from './ui/routes'

/**
 * The whole app's addresses: the shop under `ShopShellContainer`, the panel under
 * `AdminShellContainer`, and one catch-all.
 *
 * `LinkInterceptor` wraps the route table rather than sitting inside it, because it has to see
 * clicks on the shells' own chrome — the shop header's `Sobre`, the drawer's `Ir para o pagamento`,
 * the panel bar's `Produtos` and `Pedidos` — which are rendered by the two containers AROUND the
 * `<Outlet/>` and not by any route.
 *
 * THE PANEL IS UNLINKED (spec:11). Nothing in the shop points at `/admin`: the design's "Admin" nav
 * item stays dropped and the address is one Augusto types. `ui/routes.ts` keeps its admin builders
 * because the panel's own chrome is built from them, so the rule cannot be enforced by their
 * absence — `app-routes.test.tsx` enforces it by reading which files call them.
 *
 * THERE IS NO LOGIN ADDRESS, and that is the design rather than an omission. `AdminShellContainer`
 * renders `LoginRoute` in place of `<Outlet/>` whenever there is no session, so a cold deep link to
 * `/admin/orders` shows the login AT `/admin/orders` and reveals the orders the moment it is
 * answered. Mounting the login as its own path would put a redirect between the reader and the
 * address they asked for — the destination lost on the way in, and the loop that guard/login pairs
 * are famous for. The index redirect sits UNDER the guard for the same reason: `/admin` typed while
 * signed out stays `/admin`.
 *
 * `/admin` ITSELF HAS NO SCREEN. It is the panel's front door and the index route decides which of
 * the two sections is behind it. The redirect's TARGET comes from `ui/routes.ts` while the paths
 * beside it do not, and the two are different things: a `path` is a pattern (`products/:id` is not
 * a URL), a `to` is an address, and addresses are what that module exists to spell.
 *
 * The catch-all REDIRECTS to the catalogue rather than rendering a not-found screen, and the two are
 * deliberately different answers: `NoticePage` exists for a piece the catalogue could not give us,
 * which is a real address with nothing behind it, while an unrouted path is not an address this app
 * has ever had. `/admin` used to be the exception to that — a real address with no screen, tracked
 * by a skipped e2e test — and it is one no longer.
 */
export default function App() {
  return (
    <LinkInterceptor>
      <Routes>
        <Route element={<ShopShellContainer />}>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/exhibit/:slug" element={<ProductRoute />} />
          <Route path="/about" element={<AboutRoute />} />
          <Route path="/checkout" element={<CheckoutRoute />} />
          <Route path="/thanks" element={<DoneRoute />} />
        </Route>
        <Route path="/admin" element={<AdminShellContainer />}>
          <Route index element={<Navigate to={routes.adminProducts()} replace />} />
          <Route path="products" element={<ProductsRoute />} />
          {/* One element at two paths. `ProductFormRoute` reads `useParams().id`, so `new` is the
              absence of the param and not a mode flag — and the more specific literal path is
              matched ahead of the dynamic one by react-router's own ranking, not by this order. */}
          <Route path="products/new" element={<ProductFormRoute />} />
          <Route path="products/:id" element={<ProductFormRoute />} />
          <Route path="orders" element={<OrdersRoute />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </LinkInterceptor>
  )
}
