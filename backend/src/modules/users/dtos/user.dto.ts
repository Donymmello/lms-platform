import { Role } from "@prisma/client";

/** Safe, public-facing shape of a User — the password hash never leaves the service layer. */
export interface UserResponseDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
}

export interface PaginatedUsersDto {
  users: UserResponseDto[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
