import jwt, { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import crypto from "node:crypto";
import { Role } from "@prisma/client";
import { env } from "../config/env";
import { UnauthorizedError } from "../errors";

export interface AccessTokenPayload {
  sub: string; // user id
  role: Role;
}

/**
 * Issued after the password check but before the second factor. Carries a
 * `purpose` so it can never be mistaken for a session — see verifyAccessToken.
 */
export interface TwoFactorChallengePayload {
  sub: string;
  purpose: "two_factor";
}

export interface RefreshTokenPayload {
  sub: string; // user id
  jti: string; // token id, used to look up its hash in the database
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload & {
      purpose?: string;
    };

    // Single-purpose tokens (currently the two-factor challenge) are signed
    // with the same secret, so without this check one could be presented as a
    // session cookie and would authenticate — skipping the second factor
    // entirely. A session token never carries `purpose`.
    if (payload.purpose) {
      throw new UnauthorizedError("Invalid access token");
    }

    return payload;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    if (error instanceof TokenExpiredError) {
      throw new UnauthorizedError("Access token expired");
    }
    if (error instanceof JsonWebTokenError) {
      throw new UnauthorizedError("Invalid access token");
    }
    throw error;
  }
}

/** Valid for minutes, not hours: it only has to survive typing a six-digit code. */
export function signTwoFactorChallenge(userId: string): string {
  return jwt.sign({ sub: userId, purpose: "two_factor" }, env.JWT_ACCESS_SECRET, {
    expiresIn: "5m",
  });
}

export function verifyTwoFactorChallenge(token: string): TwoFactorChallengePayload {
  let payload: TwoFactorChallengePayload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as TwoFactorChallengePayload;
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      throw new UnauthorizedError("This sign-in attempt has expired. Start again.");
    }
    if (error instanceof JsonWebTokenError) {
      throw new UnauthorizedError("Invalid sign-in attempt");
    }
    throw error;
  }

  // A session token must not be accepted here either: the two have to stay
  // strictly separate in both directions.
  if (payload.purpose !== "two_factor") {
    throw new UnauthorizedError("Invalid sign-in attempt");
  }
  return payload;
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      throw new UnauthorizedError("Refresh token expired");
    }
    if (error instanceof JsonWebTokenError) {
      throw new UnauthorizedError("Invalid refresh token");
    }
    throw error;
  }
}

export function newTokenId(): string {
  return crypto.randomUUID();
}

/**
 * Refresh tokens are only ever stored as a SHA-256 hash — never in plain
 * text — so that a leaked database dump cannot be used to impersonate
 * users. This is a fast deterministic hash (not bcrypt) because the input
 * is already a high-entropy random JWT, not a user-chosen secret.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
