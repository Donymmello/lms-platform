import { AsyncLocalStorage } from "node:async_hooks";
import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";

/**
 * Records the acts that change who can do what.
 *
 * The request context comes from AsyncLocalStorage rather than being threaded
 * through every service signature. The alternative was adding an `ip`
 * parameter to six functions and every test that calls them, to carry
 * something none of them otherwise cares about.
 */

/**
 * Holds the request itself, not values copied out of it. `req.user` is
 * populated by `authenticate`, which runs per-router — after this context is
 * established — so reading the id when the context is created would always
 * find it empty. Reading it when the entry is written finds it set.
 */
interface RequestContext {
  getActorId?: () => string | undefined;
  ip?: string;
}

const store = new AsyncLocalStorage<RequestContext>();

/** Wraps one request so anything it calls can record who is acting. */
export function runWithAuditContext<T>(context: RequestContext, fn: () => T): T {
  return store.run(context, fn);
}

export interface AuditEntry {
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
  /** Overrides the actor from the request context — for an act with no session, like completing a password reset. */
  actorId?: string;
  actorEmail?: string;
}

export const audit = {
  /**
   * Writes one event. Best-effort on purpose: a failed insert here must not
   * fail the thing being recorded. Refusing someone's password reset because
   * an audit row could not be written trades a real problem for a worse one,
   * so the failure is logged loudly and the act proceeds.
   *
   * That is the right call for this application and the wrong one for, say, a
   * bank. If the log ever becomes something a decision depends on, this is
   * the line to revisit.
   */
  async record(entry: AuditEntry): Promise<void> {
    const context = store.getStore() ?? {};

    try {
      await prisma.auditEvent.create({
        data: {
          action: entry.action,
          actorId: entry.actorId ?? context.getActorId?.() ?? null,
          actorEmail: entry.actorEmail ?? null,
          targetType: entry.targetType ?? null,
          targetId: entry.targetId ?? null,
          metadata: entry.metadata,
          ip: context.ip ?? null,
        },
      });
    } catch (error) {
      // Same convention as the rest of the codebase: no log library here.
      console.error(`Failed to write audit event "${entry.action}":`, error);
    }
  },
};
