import { apiFetch } from "@/services/api-client";
import { ApiSuccessResponse, User } from "@/types/auth";
import { LoginFormValues, RegisterFormValues } from "@/validators/auth.validator";

type UserPayload = ApiSuccessResponse<{ user: User }>;

export const authService = {
  async register(input: RegisterFormValues): Promise<User> {
    const res = await apiFetch<UserPayload>("/auth/register", { method: "POST", body: input });
    return res.data.user;
  },

  async login(input: LoginFormValues): Promise<User> {
    const res = await apiFetch<UserPayload>("/auth/login", { method: "POST", body: input });
    return res.data.user;
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
