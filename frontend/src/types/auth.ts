export type Role = "ADMIN" | "INSTRUCTOR" | "STUDENT";

/** Mirrors the backend's UserResponseDto — never includes the password hash. */
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
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
