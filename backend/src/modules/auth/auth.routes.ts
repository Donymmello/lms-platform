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

authRouter.get("/me", authenticate, authController.me);
