import { NextFunction, Request, Response } from "express";
import { ACCESS_TOKEN_COOKIE } from "../constants/cookies";
import { verifyAccessToken } from "../utils/jwt";

/**
 * Like `authenticate`, but never rejects the request — it just leaves
 * `req.user` unset when there's no cookie, or when the token is invalid or
 * expired. For routes that behave differently for a logged-in user but must
 * also stay reachable anonymously (e.g. free-preview lesson playback).
 */
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined;
  if (!token) {
    next();
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
  } catch {
    // Invalid/expired token on an optional route — proceed unauthenticated
    // instead of failing the request.
  }
  next();
}
