import { Role } from "@/types/auth";

/** Mirrors the backend's UserResponseDto for the admin user-management endpoints. */
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedUsers {
  users: AdminUser[];
  pagination: Pagination;
}

export interface ListUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: Role;
}
