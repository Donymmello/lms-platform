"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { homePathForRole } from "@/lib/routes";
import { Role } from "@/types/auth";

/**
 * Sends a signed-in user away from an area their role has no business in —
 * an instructor who lands on /admin ends up on /instructor instead of a
 * page where half the requests would come back 403.
 *
 * This is a UX guard, not a security boundary: it runs in the browser and
 * renders nothing. Real authorization is the backend's `checkRole` on every
 * request, which this cannot weaken.
 */
export function RoleGuard({ allow }: { allow: Role[] }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  // Callers pass an inline array literal, which is a new reference on every
  // render; depending on its contents instead keeps the effect from re-running
  // each time the layout renders.
  const allowed = allow.join(",");

  useEffect(() => {
    if (isLoading || !user) return;
    if (!allowed.split(",").includes(user.role)) {
      router.replace(homePathForRole(user.role));
    }
  }, [allowed, isLoading, router, user]);

  return null;
}
