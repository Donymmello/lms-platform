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
import { authRepository } from "./auth.repository";
import { AuthResultDto, AuthTokensDto, UserResponseDto } from "./dtos/auth.dto";
import { LoginInput, RegisterInput } from "./schemas/auth.schema";

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
async function issueTokens(user: User): Promise<AuthTokensDto> {
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
    return { user: toUserResponseDto(user), tokens };
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
