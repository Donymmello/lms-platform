import { Role, User } from "@prisma/client";
import { prisma } from "../../database/prisma";

/**
 * Repository layer: the only place in the module that talks to Prisma.
 * Services never import `prisma` directly — this keeps persistence
 * concerns isolated and swappable.
 */
export const authRepository = {
  findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  },

  findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  create(data: { name: string; email: string; passwordHash: string; role?: Role }): Promise<User> {
    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: data.passwordHash,
        role: data.role ?? Role.STUDENT,
      },
    });
  },

  storeRefreshToken(params: { tokenHash: string; userId: string; expiresAt: Date }) {
    return prisma.refreshToken.create({
      data: {
        tokenHash: params.tokenHash,
        userId: params.userId,
        expiresAt: params.expiresAt,
      },
    });
  },

  findActiveRefreshTokenByHash(tokenHash: string) {
    return prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    });
  },

  revokeRefreshTokenByHash(tokenHash: string) {
    return prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  revokeAllRefreshTokensForUser(userId: string) {
    return prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};
