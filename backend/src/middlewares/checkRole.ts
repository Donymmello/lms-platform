import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { ForbiddenError, UnauthorizedError } from "../errors";

/**
 * Role-based access control middleware. Must run after `authenticate`.
 * Usage: `router.delete("/:id", authenticate, checkRole(["ADMIN"]), handler)`.
 */
export function checkRole(allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required");
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError("You do not have permission to perform this action");
    }

    next();
  };
}
