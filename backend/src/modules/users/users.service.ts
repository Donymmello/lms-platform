import { User } from "@prisma/client";
import { ForbiddenError, NotFoundError } from "../../errors";
import { authRepository } from "../auth/auth.repository";
import { PaginatedUsersDto, UserResponseDto } from "./dtos/user.dto";
import { ListUsersQuery, UpdateUserRoleInput, UpdateUserStatusInput } from "./schemas/user.schema";
import { usersRepository } from "./users.repository";

function toUserResponseDto(user: User): UserResponseDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

async function requireUser(id: string): Promise<User> {
  const user = await usersRepository.findById(id);
  if (!user) {
    throw new NotFoundError("User not found");
  }
  return user;
}

export const usersService = {
  async list(query: ListUsersQuery): Promise<PaginatedUsersDto> {
    const { users, total } = await usersRepository.findMany(query);
    return {
      users: users.map(toUserResponseDto),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  },

  async getById(id: string): Promise<UserResponseDto> {
    const user = await requireUser(id);
    return toUserResponseDto(user);
  },

  async updateRole(
    targetId: string,
    input: UpdateUserRoleInput,
    actingUserId: string
  ): Promise<UserResponseDto> {
    if (targetId === actingUserId) {
      throw new ForbiddenError("You cannot change your own role");
    }

    await requireUser(targetId);
    const updated = await usersRepository.updateRole(targetId, input.role);
    return toUserResponseDto(updated);
  },

  async updateStatus(
    targetId: string,
    input: UpdateUserStatusInput,
    actingUserId: string
  ): Promise<UserResponseDto> {
    if (targetId === actingUserId) {
      throw new ForbiddenError("You cannot deactivate your own account");
    }

    await requireUser(targetId);
    const updated = await usersRepository.updateStatus(targetId, input.isActive);

    // Deactivating a user must take effect immediately, not just at their
    // access token's next 15-minute expiry — revoking every refresh token
    // blocks them from minting a new one, and the access token dies shortly after.
    if (!input.isActive) {
      await authRepository.revokeAllRefreshTokensForUser(targetId);
    }

    return toUserResponseDto(updated);
  },
};
