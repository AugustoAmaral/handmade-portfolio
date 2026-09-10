import { Navigate, Route, Routes } from 'react-router'
import { LinkInterceptor } from './app/LinkInterceptor'
import { ShopShellContainer } from './app/ShopShellContainer'
import { AboutRoute } from './app/routes/AboutRoute'
import { CheckoutRoute } from './app/routes/CheckoutRoute'
import { DoneRoute } from './app/routes/DoneRoute'
import { HomeRoute } from './app/routes/HomeRoute'
import { ProductRoute } from './app/routes/ProductRoute'

/**
 * SHOP ROUTES ONLY. The admin is rebuilt in PR 4 and its routes arrive with it; until then `/admin*`
 * falls into the catch-all below. That is safe because these PRs merge into `docs/v2-design` and not
 * into `main` — production keeps serving v1 until PR 5 lands. `ui/routes.ts` keeps its admin href
 * builders: they are strings, nothing in the shop renders them (the design drops the Admin nav item
 * entirely), and PR 4 consumes them.
 *
 * `LinkInterceptor` wraps the route table rather than sitting inside it, because it has to see
 * clicks on the shell's own chrome — the header's `Sobre`, the drawer's `Ir para o pagamento` —
 * which are rendered by `ShopShellContainer` around the `<Outlet/>` and not by any route.
 *
 * The catch-all REDIRECTS to the catalogue rather than rendering a not-found screen, and the two are
 * deliberately different answers: `NoticePage` exists for a piece the catalogue could not give us,
 * which is a real address with nothing behind it, while an unrouted path is not an address this app
 * has ever had. The one exception is `/admin`, which IS such an address today — and it is a
 * temporary one, tracked by the skipped e2e test rather than by a screen that would have to be
 * deleted again in PR 4.
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </LinkInterceptor>
  )
}
