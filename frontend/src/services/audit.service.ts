import { apiFetch } from "@/services/api-client";
import { ApiSuccessResponse } from "@/types/auth";
import { AuditPage } from "@/types/audit";

export const auditService = {
  /** Admin only; anyone else gets a 403. */
  async list(params: { page?: number; pageSize?: number; action?: string } = {}): Promise<AuditPage> {
    const res = await apiFetch<ApiSuccessResponse<AuditPage>>("/audit", {
      query: { page: params.page, pageSize: params.pageSize, action: params.action },
    });
    return res.data;
  },
};
