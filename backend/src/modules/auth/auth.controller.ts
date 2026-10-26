import crypto from "node:crypto";
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError, UnauthorizedError } from "../../errors";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_VERIFIER_COOKIE,
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
  clearGoogleOAuthCookies,
  googleOAuthCookieOptions,
  setAuthCookies,
} from "../../constants/cookies";
import { env } from "../../config/env";
import { authService } from "./auth.service";
import { googleOAuthService } from "./google-oauth.service";
import { twoFactorService } from "./two-factor.service";
import {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  TwoFactorCodeInput,
  TwoFactorDisableInput,
  TwoFactorVerifyInput,
} from "./schemas/auth.schema";

function googleLoginUrl(error: string): string {
  const url = new URL("/login", env.PUBLIC_APP_URL);
  url.searchParams.set("google_error", error);
  return url.toString();
}

function matchesState(expected: unknown, received: unknown): expected is string {
  if (typeof expected !== "string" || typeof received !== "string") return false;
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return expectedBytes.length === receivedBytes.length && crypto.timingSafeEqual(expectedBytes, receivedBytes);
}

export const authController = {
  googleStart: asyncHandler(async (_req: Request, res: Response) => {
    if (!googleOAuthService.isConfigured()) {
      res.redirect(googleLoginUrl("not_configured"));
      return;
    }

    const state = crypto.randomBytes(32).toString("hex");
    const verifier = crypto.randomBytes(32).toString("base64url");
    res.cookie(GOOGLE_OAUTH_STATE_COOKIE, state, googleOAuthCookieOptions());
    res.cookie(GOOGLE_OAUTH_VERIFIER_COOKIE, verifier, googleOAuthCookieOptions());
    res.redirect(googleOAuthService.createAuthorizationUrl(state, verifier));
  }),

  googleCallback: asyncHandler(async (req: Request, res: Response) => {
    const providerError = req.query.error;
    if (providerError) {
      clearGoogleOAuthCookies(res);
      res.redirect(googleLoginUrl("cancelled"));
      return;
    }

    const { code, state } = req.query;
    const savedState: unknown = req.cookies?.[GOOGLE_OAUTH_STATE_COOKIE];
    const verifier: unknown = req.cookies?.[GOOGLE_OAUTH_VERIFIER_COOKIE];
    clearGoogleOAuthCookies(res);

    if (typeof code !== "string" || !matchesState(savedState, state) || typeof verifier !== "string") {
      res.redirect(googleLoginUrl("invalid_state"));
      return;
    }

    try {
      const profile = await googleOAuthService.getProfile(code, verifier);
      const result = await authService.loginWithGoogle(profile);
      setAuthCookies(res, result.tokens);
      res.redirect(new URL("/auth/google/callback", env.PUBLIC_APP_URL).toString());
    } catch (error) {
      if (!(error instanceof AppError)) throw error;

      const details =
        typeof error.details === "object" && error.details !== null
          ? (error.details as { code?: unknown })
          : {};
      const frontendError =
        details.code === "TWO_FACTOR_REQUIRED"
          ? "two_factor_required"
          : error.statusCode === 403
            ? "account_unavailable"
            : error.statusCode === 409
              ? "account_conflict"
              : error.statusCode === 503
                ? "not_configured"
                : "failed";
      res.redirect(googleLoginUrl(frontendError));
    }
  }),

  register: asyncHandler(async (req: Request<unknown, unknown, RegisterInput>, res: Response) => {
    const { user, tokens } = await authService.register(req.body);
    setAuthCookies(res, tokens);
    res.status(201).json({ status: "success", data: { user } });
  }),

  forgotPassword: asyncHandler(
    async (req: Request<unknown, unknown, ForgotPasswordInput>, res: Response) => {
      await authService.forgotPassword(req.body);
      // Deliberately the same answer whether or not the address is registered.
      res.status(200).json({
        status: "success",
        data: { message: "Se existir uma conta com esse email, enviámos um link." },
      });
    }
  ),

  resetPassword: asyncHandler(
    async (req: Request<unknown, unknown, ResetPasswordInput>, res: Response) => {
      await authService.resetPassword(req.body);
      // No session is issued: the user signs in with the new password, which
      // proves they know it.
      clearAuthCookies(res);
      res.status(200).json({ status: "success", data: null });
    }
  ),

  login: asyncHandler(async (req: Request<unknown, unknown, LoginInput>, res: Response) => {
    const result = await authService.login(req.body);

    // A challenge is not a session: no cookies are set, and the client is
    // told to collect a code.
    if ("requiresTwoFactor" in result) {
      res.status(200).json({ status: "success", data: result });
      return;
    }

    setAuthCookies(res, result.tokens);
    res.status(200).json({ status: "success", data: { user: result.user } });
  }),

  verifyTwoFactor: asyncHandler(
    async (req: Request<unknown, unknown, TwoFactorVerifyInput>, res: Response) => {
      const { user, tokens } = await authService.completeTwoFactorLogin(req.body);
      setAuthCookies(res, tokens);
      res.status(200).json({ status: "success", data: { user } });
    }
  ),

  beginTwoFactorEnrolment: asyncHandler(async (req: Request, res: Response) => {
    const setup = await twoFactorService.beginEnrolment(req.user!.id);
    res.status(200).json({ status: "success", data: setup });
  }),

  confirmTwoFactorEnrolment: asyncHandler(
    async (req: Request<unknown, unknown, TwoFactorCodeInput>, res: Response) => {
      const recoveryCodes = await twoFactorService.confirmEnrolment(req.user!.id, req.body.code);
      // Shown once — only their hashes are stored.
      res.status(200).json({ status: "success", data: { recoveryCodes } });
    }
  ),

  disableTwoFactor: asyncHandler(
    async (req: Request<unknown, unknown, TwoFactorDisableInput>, res: Response) => {
      await twoFactorService.disable(req.user!.id, req.body.password, req.body.code);
      res.status(200).json({ status: "success", data: null });
    }
  ),

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
