import { NextRequest, NextResponse } from "next/server";

// Must match backend/src/constants/cookies.ts (ACCESS_TOKEN_COOKIE / REFRESH_TOKEN_COOKIE).
const ACCESS_TOKEN_COOKIE = "access_token";
const REFRESH_TOKEN_COOKIE = "refresh_token";

const AUTH_PAGES = ["/login", "/register"];
// Reachable signed in or out: someone already logged in may still want to
// change a password they no longer trust.
const PUBLIC_AUTH_PAGES = ["/forgot-password", "/reset-password"];
const PROTECTED_PREFIXES = ["/admin", "/instructor", "/seguranca", "/student"];

/**
 * Builds the Content-Security-Policy for one request.
 *
 * Script sources are a per-request nonce plus `strict-dynamic`, not
 * `unsafe-inline`: Next injects inline bootstrap scripts on every page, so a
 * policy without a nonce would have to allow all inline script, which is most
 * of what CSP is for. Next reads the nonce back out of this header and stamps
 * it onto the scripts it renders, which is why it is set on the request as
 * well as the response.
 *
 * What each relaxation is buying:
 *
 * - `style-src 'unsafe-inline'` because the components set style attributes
 *   directly (`style={{ "--i": index }}` on the shelf cards, the generated
 *   course covers). CSP3 would let those be separated out as `style-src-attr`,
 *   but no browser in use enforces it independently yet, so it would be a
 *   false sense of tightening.
 * - `img-src https:` because an instructor can point a course thumbnail at any
 *   host, and `data:` because the generated cover and the film-grain texture
 *   are inline SVG.
 * - `connect-src` names the API explicitly: in development it runs on a
 *   different port, so same-origin would block every request the app makes.
 * - `frame-src https:` for a Bunny Stream embed. What stops this site being
 *   framed by someone else is `frame-ancestors 'none'`, which is unrelated.
 * - `'unsafe-eval'` in development only. React's fast refresh needs it; in a
 *   built app nothing does.
 */
function contentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  // The origin, not the /api/v1 path: connect-src matches on origin.
  //
  // Wrapped because this runs on every request: a malformed value here would
  // otherwise throw and turn every page in the site into a 500, which is a
  // much worse failure than a policy that is missing one entry.
  let apiOrigin = "";
  try {
    const api = process.env.NEXT_PUBLIC_API_URL;
    if (api) apiOrigin = new URL(api).origin;
  } catch {
    // Left empty: 'self' still covers the same-origin deployment.
  }

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    `connect-src 'self' ${apiOrigin}`.trim(),
    `media-src 'self' blob: ${apiOrigin}`.trim(),
    "frame-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Nobody may frame this site: the clickjacking half of the problem.
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

/**
 * Two jobs, because Next runs one middleware.
 *
 * The first is the security headers, which is why the matcher below covers
 * every page rather than only the private ones.
 *
 * The second is an edge-level redirect guard. It only checks whether an auth
 * cookie is *present* — it deliberately does not verify the JWT signature,
 * since middleware runs on the Edge runtime where Node's crypto APIs (used by
 * `jsonwebtoken`) aren't available. Real authorization still happens on every
 * request via the backend's `authenticate` / `checkRole`; this is a UX layer
 * to avoid flashing a protected page before bouncing a visitor to /login.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = crypto.randomUUID();
  const csp = contentSecurityPolicy(nonce);

  // Next looks for the nonce here when rendering its own script tags.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  function withSecurityHeaders(response: NextResponse): NextResponse {
    response.headers.set("content-security-policy", csp);
    response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
    response.headers.set("x-content-type-options", "nosniff");
    response.headers.set("x-frame-options", "DENY");
    // Nothing here uses a camera, a microphone or a location.
    response.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
    return response;
  }

  const hasSession = Boolean(
    request.cookies.get(ACCESS_TOKEN_COOKIE) ?? request.cookies.get(REFRESH_TOKEN_COOKIE)
  );

  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (isProtectedRoute && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return withSecurityHeaders(NextResponse.redirect(loginUrl));
  }

  if (isAuthPage && hasSession) {
    return withSecurityHeaders(NextResponse.redirect(new URL("/", request.url)));
  }

  if (PUBLIC_AUTH_PAGES.includes(pathname)) {
    return withSecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  return withSecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }));
}

export const config = {
  /*
   * Every page, because the headers have to reach every page. Excluded:
   * Next's own static output and the image optimiser, which are immutable
   * assets that no policy applies to, and the favicon.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
