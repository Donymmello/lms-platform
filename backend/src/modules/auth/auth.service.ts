import crypto from "node:crypto";
import { User } from "@prisma/client";
import { ConflictError, ForbiddenError, UnauthorizedError } from "../../errors";
import { comparePassword, hashPassword } from "../../utils/password";
import {
  hashToken,
  newTokenId,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwt";
import { parseExpiryToMs } from "../../constants/cookies";
import { env } from "../../config/env";
import { notifications } from "../../notifications/notifications";
import { authRepository } from "./auth.repository";
import { AuthResultDto, AuthTokensDto, UserResponseDto } from "./dtos/auth.dto";
import {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "./schemas/auth.schema";

/** Short on purpose: a reset link is a bearer credential sitting in an inbox. */
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

function toUserResponseDto(user: User): UserResponseDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

/** Issues a fresh access/refresh token pair and persists the refresh token's hash. */
export async function issueTokens(user: User): Promise<AuthTokensDto> {
  const accessToken = signAccessToken({ sub: user.id, role: user.role });

  const tokenId = newTokenId();
  const refreshToken = signRefreshToken({ sub: user.id, jti: tokenId });

  await authRepository.storeRefreshToken({
    tokenHash: hashToken(refreshToken),
    userId: user.id,
    expiresAt: new Date(Date.now() + parseExpiryToMs(env.JWT_REFRESH_EXPIRES_IN)),
  });

  return { accessToken, refreshToken };
}

export const authService = {
  async register(input: RegisterInput): Promise<AuthResultDto> {
    const existingUser = await authRepository.findByEmail(input.email);
    if (existingUser) {
      throw new ConflictError("An account with this email already exists");
    }

    const passwordHash = await hashPassword(input.password);
    const user = await authRepository.create({
      name: input.name,
      email: input.email,
      passwordHash,
    });

    const tokens = await issueTokens(user);
    notifications.userRegistered(user);
    return { user: toUserResponseDto(user), tokens };
  },

  /**
   * Starts a reset. Always resolves the same way, whether or not the address
   * belongs to an account: replying differently would turn this endpoint into
   * a way to test which emails are registered, the same reason login gives one
   * error for both "no such user" and "wrong password".
   *
   * The raw token is generated here and never stored — only its SHA-256 hash
   * goes to the database, so a leaked dump cannot be redeemed. Any earlier
   * unused token is deleted first, so only the newest email works.
   */
  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const user = await authRepository.findByEmail(input.email);
    if (!user || !user.isActive) return;

    await authRepository.deleteUnusedPasswordResetTokensForUser(user.id);

    const rawToken = crypto.randomBytes(32).toString("hex");
    await authRepository.createPasswordResetToken({
      tokenHash: hashToken(rawToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    });

    notifications.passwordReset(user, rawToken);
  },

  /**
   * Redeems a token and sets the new password.
   *
   * Every existing refresh token is revoked on success. Someone resetting a
   * password is often doing it because a session is not theirs any more, and
   * leaving old sessions alive would let whoever took the account keep it.
   */
  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const record = await authRepository.findPasswordResetTokenByHash(hashToken(input.token));

    // One message for every failure mode — expired, already spent, never
    // existed — so probing cannot distinguish them.
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now() || !record.user.isActive) {
      throw new UnauthorizedError("This password reset link is invalid or has expired");
    }

    await authRepository.updatePassword(record.userId, await hashPassword(input.password));
    await authRepository.markPasswordResetTokenUsed(record.id);
    await authRepository.revokeAllRefreshTokensForUser(record.userId);
  },

  async login(input: LoginInput): Promise<AuthResultDto> {
    const user = await authRepository.findByEmail(input.email);
    // Deliberately identical error/timing-shaped response for "no such user"
    // and "wrong password" so login cannot be used to enumerate accounts.
    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const passwordMatches = await comparePassword(input.password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedError("Invalid email or password");
    }

    if (!user.isActive) {
      throw new ForbiddenError("This account has been deactivated");
    }

    const tokens = await issueTokens(user);
    return { user: toUserResponseDto(user), tokens };
  },

  /**
   * Rotates a refresh token: the presented token is verified, checked
   * against the (hashed) database record, and revoked; a brand new
   * access/refresh pair is issued. Reusing an already-revoked or unknown
   * refresh token revokes every session for that user, since it indicates
   * the token was stolen and already used by an attacker (or the victim).
   */
  async refresh(rawRefreshToken: string): Promise<AuthResultDto> {
    const payload = verifyRefreshToken(rawRefreshToken);
    const tokenHash = hashToken(rawRefreshToken);

    const storedToken = await authRepository.findActiveRefreshTokenByHash(tokenHash);
    if (!storedToken) {
      await authRepository.revokeAllRefreshTokensForUser(payload.sub);
      throw new UnauthorizedError("Refresh token is invalid or has already been used");
    }

    const user = await authRepository.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedError("User no longer exists");
    }

    if (!user.isActive) {
      await authRepository.revokeAllRefreshTokensForUser(user.id);
      throw new ForbiddenError("This account has been deactivated");
    }

    await authRepository.revokeRefreshTokenByHash(tokenHash);

    const tokens = await issueTokens(user);
    return { user: toUserResponseDto(user), tokens };
  },

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    await authRepository.revokeRefreshTokenByHash(hashToken(rawRefreshToken));
  },

  async getCurrentUser(userId: string): Promise<UserResponseDto> {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError("User no longer exists");
    }
    return toUserResponseDto(user);
  },
};
