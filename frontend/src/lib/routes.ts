import { Role } from "@/types/auth";

/**
 * Where each role lands after signing in, and where "a minha área" points.
 * Kept in one place so the login form, the public nav and the role guard
 * can never disagree about it.
 */
export function homePathForRole(role: Role): string {
  switch (role) {
    case "STUDENT":
      return "/student/courses";
    case "INSTRUCTOR":
      return "/instructor";
    case "ADMIN":
      return "/admin";
  }
}
