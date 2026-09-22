import { apiFetch } from "@/services/api-client";
import { ApiSuccessResponse, Role } from "@/types/auth";
import { User } from "@/types/auth";
import { AdminUser, ListUsersParams, PaginatedUsers } from "@/types/user";

export const usersService = {
  /**
   * Turns the signed-in account into an instructor account. The backend
   * re-issues the session cookies, because the role is a claim inside the
   * access token — without that the caller would keep being refused by the
   * instructor routes until the old token expired.
   */
  async becomeInstructor(): Promise<User> {
    const res = await apiFetch<ApiSuccessResponse<{ user: User }>>("/users/me/become-instructor", {
      method: "POST",
    });
    return res.data.user;
  },

  async list(params: ListUsersParams): Promise<PaginatedUsers> {
    const res = await apiFetch<ApiSuccessResponse<PaginatedUsers>>("/users", {
      query: {
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        role: params.role,
      },
    });
    return res.data;
  },

  async updateRole(id: string, role: Role): Promise<AdminUser> {
    const res = await apiFetch<ApiSuccessResponse<{ user: AdminUser }>>(`/users/${id}/role`, {
      method: "PATCH",
      body: { role },
    });
    return res.data.user;
  },

  async updateStatus(id: string, isActive: boolean): Promise<AdminUser> {
    const res = await apiFetch<ApiSuccessResponse<{ user: AdminUser }>>(`/users/${id}/status`, {
      method: "PATCH",
      body: { isActive },
    });
    return res.data.user;
  },
};
