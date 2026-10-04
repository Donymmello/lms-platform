import { Role, User } from "@prisma/client";
import { ForbiddenError, NotFoundError } from "../../errors";
import { authRepository } from "../auth/auth.repository";
import { PaginatedUsersDto, UserResponseDto } from "./dtos/user.dto";
import {
  InstructorRequestInput,
  ListUsersQuery,
  UpdateUserRoleInput,
  UpdateUserStatusInput,
} from "./schemas/user.schema";
import { notifications } from "../../notifications/notifications";
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
   * Asks for instructor access. Deliberately changes nothing about the
   * account — it writes an audit entry and mails the admins, and that is all.
   *
   * This is the replacement for the self-service upgrade that used to live
   * here and promoted the caller on the spot. The shape is similar enough to
   * be worth saying plainly: this route can be called by any student, and it
   * must stay unable to grant anything. Promotion happens through
   * `updateRole` below, which is ADMIN-only.
   */
  async requestInstructorAccess(actingUserId: string, input: InstructorRequestInput): Promise<void> {
    const user = await requireUser(actingUserId);

    // Already able to teach: not an error worth showing, and mailing the
    // admins about it would be noise.
    if (user.role !== Role.STUDENT) return;

    // Written before the mail is sent, and this order matters: delivery is
    // fire-and-forget and may fail, so the log is the durable record of the
    // request rather than a copy of it.
    await audit.record({
      action: "user.requested_instructor",
      actorEmail: user.email,
      targetType: "user",
      targetId: user.id,
      metadata: { message: input.message },
    });

    const admins = await usersRepository.findAdmins();
    if (admins.length === 0) {
      // Nobody can act on it, and nobody will be told. The request is in the
      // audit log, but the first admin still has to be created for anyone to
      // read it — see "Papéis e quem os dá" in the README.
      // eslint-disable-next-line no-console
      console.error("Instructor request received with no ADMIN account to notify:", user.email);
      return;
    }

    notifications.instructorRequested(admins, user, input.message);
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
