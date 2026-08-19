import { NextFunction, Request, Response } from "express";

/**
 * Wraps an async Express handler so rejected promises are forwarded to
 * `next()` instead of crashing the process as an unhandled rejection.
 * Keeps controllers free of repetitive try/catch blocks.
 *
 * Generic over the Express Request/Response types (deliberately unconstrained,
 * not `Req extends Request`) so controllers can use narrower, strictly-typed
 * request shapes — e.g. `Request<UserIdParam, unknown, unknown, SomeQuery>`
 * — without Express's `ParsedQs`/`ParamsDictionary` defaults rejecting them
 * as "not assignable" during type-parameter constraint checking.
 */
export function asyncHandler<Req = Request, Res = Response>(
  handler: (req: Req, res: Res, next: NextFunction) => Promise<unknown>
) {
  return (req: Req, res: Res, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}
