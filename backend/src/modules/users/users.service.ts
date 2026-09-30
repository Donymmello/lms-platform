import { Role, User } from "@prisma/client";
import { ForbiddenError, NotFoundError } from "../../errors";
import { authRepository } from "../auth/auth.repository";
import { issueTokens } from "../auth/auth.service";
import { AuthTokensDto } from "../auth/dtos/auth.dto";
import { PaginatedUsersDto, UserResponseDto } from "./dtos/user.dto";
import { ListUsersQuery, UpdateUserRoleInput, UpdateUserStatusInput } from "./schemas/user.schema";
import { audit } from "../audit/audit.service";
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

  /**
   * Self-service upgrade to INSTRUCTOR — teaching is a capability you switch
   * on, not a separate account (the model Udemy and Hotmart both use).
   *
   * The caller's role lives inside their access token, so changing the row
   * alone would leave them holding a STUDENT token for up to its full
   * lifetime and being refused by `checkRole` the whole time. A fresh token
   * pair is issued here and set as cookies by the controller.
   */
  async becomeInstructor(actingUserId: string): Promise<{ user: UserResponseDto; tokens: AuthTokensDto }> {
    const user = await requireUser(actingUserId);

    // ADMIN already outranks INSTRUCTOR, and INSTRUCTOR is the target state:
    // in both cases this is a no-op rather than an error, so a double click
    // or a stale tab cannot demote anyone.
    const updated =
      user.role === Role.STUDENT ? await usersRepository.updateRole(user.id, Role.INSTRUCTOR) : user;

    // Only when it changed something: recording the no-op would fill the log
    // with double clicks.
    if (user.role === Role.STUDENT) {
      await audit.record({
        action: "user.became_instructor",
        actorEmail: user.email,
        targetType: "user",
        targetId: user.id,
      });
    }

    return { user: toUserResponseDto(updated), tokens: await issueTokens(updated) };
  },

  async updateRole(
    targetId: string,
    input: UpdateUserRoleInput,
    actingUserId: string
  ): Promise<UserResponseDto> {
    if (targetId === actingUserId) {
      throw new ForbiddenError("You cannot change your own role");
    }

    const [target, actor] = await Promise.all([requireUser(targetId), requireUser(actingUserId)]);
    const updated = await usersRepository.updateRole(targetId, input.role);

    await audit.record({
      action: "user.role_changed",
      actorEmail: actor.email,
      targetType: "user",
      targetId,
      // Both values, because "who promoted this account to ADMIN" is the
      // question this log exists to answer, and the new role alone does not
      // say what it was before.
      metadata: { from: target.role, to: input.role, targetEmail: target.email },
    });

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

    const [target, actor] = await Promise.all([requireUser(targetId), requireUser(actingUserId)]);
    const updated = await usersRepository.updateStatus(targetId, input.isActive);

    await audit.record({
      action: input.isActive ? "user.activated" : "user.deactivated",
      actorEmail: actor.email,
      targetType: "user",
      targetId,
      metadata: { targetEmail: target.email },
    });

    // Deactivating a user must take effect immediately, not just at their
    // access token's next 15-minute expiry — revoking every refresh token
    // blocks them from minting a new one, and the access token dies shortly after.
    if (!input.isActive) {
      await authRepository.revokeAllRefreshTokensForUser(targetId);
    }

    return toUserResponseDto(updated);
  },
};
