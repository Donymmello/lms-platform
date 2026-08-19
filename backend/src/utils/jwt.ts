import jwt, { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import crypto from "node:crypto";
import { Role } from "@prisma/client";
import { env } from "../config/env";
import { UnauthorizedError } from "../errors";

export interface AccessTokenPayload {
  sub: string; // user id
  role: Role;
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
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      throw new UnauthorizedError("Access token expired");
    }
    if (error instanceof JsonWebTokenError) {
      throw new UnauthorizedError("Invalid access token");
    }
    throw error;
  }
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
