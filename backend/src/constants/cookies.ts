import { CookieOptions } from "express";
import { env } from "../config/env";

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

/** Path the refresh cookie is restricted to, so it isn't sent on every request. */
export const REFRESH_TOKEN_COOKIE_PATH = "/api/v1/auth/refresh";

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax",
  domain: env.COOKIE_DOMAIN || undefined,
};

/** in the form "15m", "7d", "30s", "1h" -> milliseconds */
export function parseExpiryToMs(expiresIn: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(expiresIn.trim());
  if (!match) {
    throw new Error(`Invalid expiry format: "${expiresIn}". Use e.g. "15m", "7d".`);
  }

  const value = Number(match[1]!);
  const unit = match[2]!;

  const unitToMs: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };

  return value * unitToMs[unit]!;
}

export function accessTokenCookieOptions(maxAgeMs: number): CookieOptions {
  return { ...baseCookieOptions, path: "/", maxAge: maxAgeMs };
}

export function refreshTokenCookieOptions(maxAgeMs: number): CookieOptions {
  return { ...baseCookieOptions, path: REFRESH_TOKEN_COOKIE_PATH, maxAge: maxAgeMs };
}

/** Options used to clear cookies must mirror the `path` used to set them. */
export function clearAccessTokenCookieOptions(): CookieOptions {
  return { ...baseCookieOptions, path: "/" };
}

export function clearRefreshTokenCookieOptions(): CookieOptions {
  return { ...baseCookieOptions, path: REFRESH_TOKEN_COOKIE_PATH };
}
