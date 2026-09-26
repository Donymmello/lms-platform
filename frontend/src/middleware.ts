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
 * Edge-level redirect guard. This only checks whether an auth cookie is
 * *present* — it deliberately does not verify the JWT signature, since
 * Next.js middleware runs on the Edge runtime where Node's crypto APIs
 * (used by `jsonwebtoken`) aren't available. Real authorization still
 * happens on every request via the backend's `authenticate` / `checkRole`
 * middleware; this is a UX layer to avoid flashing protected pages before
 * bouncing an unauthenticated visitor to /login.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(
    request.cookies.get(ACCESS_TOKEN_COOKIE) ?? request.cookies.get(REFRESH_TOKEN_COOKIE)
  );

  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (isProtectedRoute && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (PUBLIC_AUTH_PAGES.includes(pathname)) {
    return NextResponse.next();
  }

  if (isAuthPage && hasSession) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/instructor/:path*",
    "/seguranca/:path*",
    "/student/:path*",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ],
};
