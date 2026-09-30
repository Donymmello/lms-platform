import { NextFunction, Request, Response } from "express";
import { runWithAuditContext } from "../modules/audit/audit.service";

/**
 * Makes the acting user and their address available to anything this request
 * calls, so an audit entry written five layers down does not need them passed
 * as arguments.
 *
 * Runs after `authenticate` would have populated `req.user`, but is mounted
 * globally: for an unauthenticated act like completing a password reset there
 * is no user, and the address is the part worth keeping.
 */
export function auditContext(req: Request, _res: Response, next: NextFunction): void {
  // A getter, not req.user?.id: `authenticate` runs per-router, so at this
  // point there is no user yet. Reading it when an entry is actually written
  // is what makes the actor land in the record.
  runWithAuditContext({ getActorId: () => req.user?.id, ip: req.ip }, next);
}
