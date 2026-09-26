import { z } from "zod";

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must have at least 2 characters")
    .max(120, "Name must have at most 120 characters"),
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must have at least 8 characters")
    .max(72, "Password must have at most 72 characters") // bcrypt's input limit
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

const passwordRules = z
  .string()
  .min(8, "Password must have at least 8 characters")
  .max(72, "Password must have at most 72 characters") // bcrypt's input limit
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number");

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Missing reset token"),
  password: passwordRules,
});

/** Six digits from the app, or a recovery code — the service tells them apart. */
const codeField = z.string().trim().min(6, "Enter the code from your authenticator app").max(20);

export const twoFactorCodeSchema = z.object({ code: codeField });

export const twoFactorVerifySchema = z.object({
  challengeToken: z.string().min(1, "Missing sign-in challenge"),
  code: codeField,
});

export const twoFactorDisableSchema = z.object({
  password: z.string().min(1, "Password is required"),
  code: codeField,
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type TwoFactorCodeInput = z.infer<typeof twoFactorCodeSchema>;
export type TwoFactorVerifyInput = z.infer<typeof twoFactorVerifySchema>;
export type TwoFactorDisableInput = z.infer<typeof twoFactorDisableSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
