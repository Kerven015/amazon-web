/**
 * Where the admin panel lives. One place, used by the browser routes and links and by the
 * server's login guard. Not "/admin", so bots that probe /admin find nothing there.
 * (It isn't a secret: the repo and the site's JavaScript both contain it. The admin login,
 * lockout and server-side sessions are what protect the panel.)
 */
export const ADMIN_BASE = "/manager@";

/** "/manager@" + path, e.g. adminPath("/orders") */
export const adminPath = (path = "") => `${ADMIN_BASE}${path}`;

/** True for the admin's pages (not the API, which stays at /api/admin). */
export const isAdminPath = (pathname: string) => pathname === ADMIN_BASE || pathname.startsWith(`${ADMIN_BASE}/`);
