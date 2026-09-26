import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { UnauthorizedError } from "../../errors";
import { REFRESH_TOKEN_COOKIE, clearAuthCookies, setAuthCookies } from "../../constants/cookies";
import { authService } from "./auth.service";
import {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "./schemas/auth.schema";

export const authController = {
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
