/**
 * Every link in the UI layer is a real <a href>; these builders are the only place paths are
 * spelled out. A single click handler at the app root upgrades same-origin anchors to
 * client-side navigation, so UI components never import the router.
 */
const q = encodeURIComponent

export const routes = {
  home: () => '/',
  about: () => '/about',
  checkout: () => '/checkout',
  product: (slug: string) => `/exhibit/${q(slug)}`,
  thanks: (orderNumber: number, sessionId: string) => `/thanks?order=${orderNumber}&session_id=${q(sessionId)}`,
  // NO `admin: () => '/admin'`. It was here and nothing called it, and nothing on the shop side
  // ever could: spec:11 keeps the panel unlinked, so the only href this builder could produce is
  // the one address no component is allowed to point at. `App.tsx` matches `/admin` as a route
  // PATTERN, which is a different thing from an address, and the panel's own bar links to the two
  // sections rather than to their parent.
  adminProducts: () => '/admin/products',
  adminNewProduct: () => '/admin/products/new',
  adminProduct: (id: string) => `/admin/products/${q(id)}`,
  adminOrders: (selectedId?: string) => (selectedId ? `/admin/orders?order=${q(selectedId)}` : '/admin/orders'),
  mailto: (to: string, subject: string, body?: string) =>
    `mailto:${to}?subject=${q(subject)}${body ? `&body=${q(body)}` : ''}`,
}
