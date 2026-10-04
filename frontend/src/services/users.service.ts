import { apiFetch } from "@/services/api-client";
import { ApiSuccessResponse, Role } from "@/types/auth";
import { AdminUser, ListUsersParams, PaginatedUsers } from "@/types/user";

export const usersService = {
  /**
   * Asks for instructor access. Changes nothing about the account: an admin
   * decides, and the reply only confirms the request was taken.
   */
  async requestInstructorAccess(message: string): Promise<void> {
    await apiFetch("/users/me/instructor-request", { method: "POST", body: { message } });
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
