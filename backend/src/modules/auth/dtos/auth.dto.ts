import { Role } from "@prisma/client";

/** Safe, public-facing shape of a User — the password hash never leaves the service layer. */
export interface UserResponseDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
}

/**
 * Returned by login when the account has a second factor. No session is
 * issued yet — the challenge is exchanged for one by POST /auth/two-factor/verify.
 */
export interface TwoFactorChallengeDto {
  requiresTwoFactor: true;
  challengeToken: string;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResultDto {
  user: UserResponseDto;
  tokens: AuthTokensDto;
}
