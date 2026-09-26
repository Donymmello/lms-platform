export type Role = "ADMIN" | "INSTRUCTOR" | "STUDENT";

/** Mirrors the backend's UserResponseDto — never includes the password hash. */
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

/** Login answers with one of these: a signed-in user, or a demand for a code. */
export interface TwoFactorChallenge {
  requiresTwoFactor: true;
  challengeToken: string;
}

export type LoginResult = { user: User } | TwoFactorChallenge;

export interface TwoFactorSetup {
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export interface ApiSuccessResponse<T> {
  status: "success";
  data: T;
}

export interface ApiErrorResponse {
  status: "error";
  message: string;
  details?: unknown;
}
