import { Role } from "@prisma/client";

/** Safe, public-facing shape of a User — the password hash never leaves the service layer. */
export interface UserResponseDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResultDto {
  user: UserResponseDto;
  tokens: AuthTokensDto;
}
