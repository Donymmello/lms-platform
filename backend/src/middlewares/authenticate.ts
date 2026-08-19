import { NextFunction, Request, Response } from "express";
import { ACCESS_TOKEN_COOKIE } from "../constants/cookies";
import { UnauthorizedError } from "../errors";
import { verifyAccessToken } from "../utils/jwt";

/**
 * Requires a valid access token JWT in the HTTP-only cookie. On success,
 * attaches a minimal, strictly-typed `req.user` (id + role) for downstream
 * handlers and the `checkRole` middleware. The token itself is never read
 * from headers or localStorage — only from the cookie.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined;

  if (!token) {
    throw new UnauthorizedError("Authentication required");
  }

  const payload = verifyAccessToken(token);

  req.user = { id: payload.sub, role: payload.role };
  next();
}
