import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { authRateLimiter } from "../../middlewares/rateLimiter";
import { validate } from "../../middlewares/validate";
import { authController } from "./auth.controller";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  twoFactorCodeSchema,
  twoFactorDisableSchema,
  twoFactorVerifySchema,
} from "./schemas/auth.schema";

export const authRouter = Router();

authRouter.post(
  "/register",
  authRateLimiter,
  validate(registerSchema, "body"),
  authController.register
);

authRouter.post("/login", authRateLimiter, validate(loginSchema, "body"), authController.login);

authRouter.post("/refresh", authRateLimiter, authController.refresh);

authRouter.post("/logout", authController.logout);

// Rate limited like the rest of the credential surface: both are unauthenticated
// and both are worth brute-forcing — one to mine valid addresses, the other to
// guess tokens.
authRouter.post(
  "/forgot-password",
  authRateLimiter,
  validate(forgotPasswordSchema, "body"),
  authController.forgotPassword
);

authRouter.post(
  "/reset-password",
  authRateLimiter,
  validate(resetPasswordSchema, "body"),
  authController.resetPassword
);

// Unauthenticated: the caller holds a challenge, not a session. Rate limited
// because a six-digit code is guessable given enough attempts.
authRouter.post(
  "/two-factor/verify",
  authRateLimiter,
  validate(twoFactorVerifySchema, "body"),
  authController.verifyTwoFactor
);

// Managing your own second factor requires an ordinary session.
authRouter.post("/two-factor/setup", authenticate, authController.beginTwoFactorEnrolment);

authRouter.post(
  "/two-factor/enable",
  authenticate,
  authRateLimiter,
  validate(twoFactorCodeSchema, "body"),
  authController.confirmTwoFactorEnrolment
);

authRouter.post(
  "/two-factor/disable",
  authenticate,
  authRateLimiter,
  validate(twoFactorDisableSchema, "body"),
  authController.disableTwoFactor
);

authRouter.get("/me", authenticate, authController.me);
