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
  admin: () => '/admin',
  adminProducts: () => '/admin/products',
  adminNewProduct: () => '/admin/products/new',
  adminProduct: (id: string) => `/admin/products/${q(id)}`,
  adminOrders: (selectedId?: string) => (selectedId ? `/admin/orders?order=${q(selectedId)}` : '/admin/orders'),
  mailto: (to: string, subject: string, body?: string) =>
    `mailto:${to}?subject=${q(subject)}${body ? `&body=${q(body)}` : ''}`,
}
