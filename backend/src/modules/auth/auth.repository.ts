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

  createPasswordResetToken(params: { tokenHash: string; userId: string; expiresAt: Date }) {
    return prisma.passwordResetToken.create({ data: params });
  },

  findPasswordResetTokenByHash(tokenHash: string) {
    return prisma.passwordResetToken.findUnique({ where: { tokenHash }, include: { user: true } });
  },

  markPasswordResetTokenUsed(id: string) {
    return prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
  },

  /** Requesting a new link must retire any earlier one, so only the newest email works. */
  deleteUnusedPasswordResetTokensForUser(userId: string) {
    return prisma.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });
  },

  updatePassword(userId: string, passwordHash: string) {
    return prisma.user.update({ where: { id: userId }, data: { password: passwordHash } });
  },

  setTwoFactorSecret(userId: string, sealedSecret: string) {
    return prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: sealedSecret } });
  },

  enableTwoFactor(userId: string) {
    return prisma.user.update({ where: { id: userId }, data: { twoFactorEnabledAt: new Date() } });
  },

  /** Clears the secret as well as the flag, so re-enabling always starts from a fresh device pairing. */
  disableTwoFactor(userId: string) {
    return prisma.$transaction([
      prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
      prisma.user.update({
        where: { id: userId },
        data: { twoFactorSecret: null, twoFactorEnabledAt: null },
      }),
    ]);
  },

  /** Enrolment issues a complete set; any codes from a previous set stop working. */
  replaceRecoveryCodes(userId: string, codeHashes: string[]) {
    return prisma.$transaction([
      prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
      prisma.twoFactorRecoveryCode.createMany({
        data: codeHashes.map((codeHash) => ({ userId, codeHash })),
      }),
    ]);
  },

  findUnusedRecoveryCode(userId: string, codeHash: string) {
    return prisma.twoFactorRecoveryCode.findFirst({ where: { userId, codeHash, usedAt: null } });
  },

  markRecoveryCodeUsed(id: string) {
    return prisma.twoFactorRecoveryCode.update({ where: { id }, data: { usedAt: new Date() } });
  },

  countUnusedRecoveryCodes(userId: string) {
    return prisma.twoFactorRecoveryCode.count({ where: { userId, usedAt: null } });
  },

  revokeAllRefreshTokensForUser(userId: string) {
    return prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};
