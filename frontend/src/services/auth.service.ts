import { apiFetch } from "@/services/api-client";
import { ApiSuccessResponse, LoginResult, TwoFactorSetup, User } from "@/types/auth";
import { LoginFormValues, RegisterFormValues } from "@/validators/auth.validator";

type UserPayload = ApiSuccessResponse<{ user: User }>;

export const authService = {
  async register(input: RegisterFormValues): Promise<User> {
    const res = await apiFetch<UserPayload>("/auth/register", { method: "POST", body: input });
    return res.data.user;
  },

  /**
   * Resolves either to the signed-in user or to a challenge. Callers have to
   * branch — a challenge means the password was right but no session exists yet.
   */
  async login(input: LoginFormValues): Promise<LoginResult> {
    const res = await apiFetch<ApiSuccessResponse<LoginResult>>("/auth/login", {
      method: "POST",
      body: input,
    });
    return res.data;
  },

  async verifyTwoFactor(challengeToken: string, code: string): Promise<User> {
    const res = await apiFetch<UserPayload>("/auth/two-factor/verify", {
      method: "POST",
      body: { challengeToken, code },
    });
    return res.data.user;
  },

  async beginTwoFactorSetup(): Promise<TwoFactorSetup> {
    const res = await apiFetch<ApiSuccessResponse<TwoFactorSetup>>("/auth/two-factor/setup", {
      method: "POST",
    });
    return res.data;
  },

  /** Returns the recovery codes, which the server will never show again. */
  async confirmTwoFactorSetup(code: string): Promise<string[]> {
    const res = await apiFetch<ApiSuccessResponse<{ recoveryCodes: string[] }>>(
      "/auth/two-factor/enable",
      { method: "POST", body: { code } }
    );
    return res.data.recoveryCodes;
  },

  async disableTwoFactor(password: string, code: string): Promise<void> {
    await apiFetch<ApiSuccessResponse<null>>("/auth/two-factor/disable", {
      method: "POST",
      body: { password, code },
    });
  },

  /** Always resolves, whether or not the address has an account — the backend deliberately does not say. */
  async forgotPassword(email: string): Promise<void> {
    await apiFetch<ApiSuccessResponse<{ message: string }>>("/auth/forgot-password", {
      method: "POST",
      body: { email },
    });
  },

  async resetPassword(token: string, password: string): Promise<void> {
    await apiFetch<ApiSuccessResponse<null>>("/auth/reset-password", {
      method: "POST",
      body: { token, password },
    });
  },

  async logout(): Promise<void> {
    await apiFetch<ApiSuccessResponse<null>>("/auth/logout", { method: "POST" });
  },

  async me(): Promise<User> {
    const res = await apiFetch<UserPayload>("/auth/me");
    return res.data.user;
  },
};
