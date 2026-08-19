import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { UnauthorizedError } from "../../errors";
import { env } from "../../config/env";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  accessTokenCookieOptions,
  clearAccessTokenCookieOptions,
  clearRefreshTokenCookieOptions,
  parseExpiryToMs,
  refreshTokenCookieOptions,
} from "../../constants/cookies";
import { authService } from "./auth.service";
import { AuthTokensDto } from "./dtos/auth.dto";
import { LoginInput, RegisterInput } from "./schemas/auth.schema";

/** Sets both the access and refresh token cookies on the response. */
function setAuthCookies(res: Response, tokens: AuthTokensDto): void {
  res.cookie(
    ACCESS_TOKEN_COOKIE,
    tokens.accessToken,
    accessTokenCookieOptions(parseExpiryToMs(env.JWT_ACCESS_EXPIRES_IN))
  );
  res.cookie(
    REFRESH_TOKEN_COOKIE,
    tokens.refreshToken,
    refreshTokenCookieOptions(parseExpiryToMs(env.JWT_REFRESH_EXPIRES_IN))
  );
}

function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, clearAccessTokenCookieOptions());
  res.clearCookie(REFRESH_TOKEN_COOKIE, clearRefreshTokenCookieOptions());
}

export const authController = {
  register: asyncHandler(async (req: Request<unknown, unknown, RegisterInput>, res: Response) => {
    const { user, tokens } = await authService.register(req.body);
    setAuthCookies(res, tokens);
    res.status(201).json({ status: "success", data: { user } });
  }),

  login: asyncHandler(async (req: Request<unknown, unknown, LoginInput>, res: Response) => {
    const { user, tokens } = await authService.login(req.body);
    setAuthCookies(res, tokens);
    res.status(200).json({ status: "success", data: { user } });
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    if (!rawRefreshToken) {
      throw new UnauthorizedError("Refresh token missing");
    }

    const { user, tokens } = await authService.refresh(rawRefreshToken);
    setAuthCookies(res, tokens);
    res.status(200).json({ status: "success", data: { user } });
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    await authService.logout(rawRefreshToken);
    clearAuthCookies(res);
    res.status(200).json({ status: "success", data: null });
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    // `authenticate` middleware guarantees req.user is set before this runs.
    const user = await authService.getCurrentUser(req.user!.id);
    res.status(200).json({ status: "success", data: { user } });
  }),
};
