import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { authRateLimiter } from "../../middlewares/rateLimiter";
import { validate } from "../../middlewares/validate";
import { authController } from "./auth.controller";
import { loginSchema, registerSchema } from "./schemas/auth.schema";

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

authRouter.get("/me", authenticate, authController.me);
