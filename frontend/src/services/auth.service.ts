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

  async logout(): Promise<void> {
    await apiFetch<ApiSuccessResponse<null>>("/auth/logout", { method: "POST" });
  },

  async me(): Promise<User> {
    const res = await apiFetch<UserPayload>("/auth/me");
    return res.data.user;
  },
};
