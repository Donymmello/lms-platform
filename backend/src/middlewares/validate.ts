import { NextFunction, Request, Response } from "express";
import { AnyZodObject } from "zod";

type RequestPart = "body" | "params" | "query";

/**
 * Parses and replaces `req[part]` with the Zod-validated (and coerced)
 * value, so 100% of inbound body/params/query data is validated before it
 * ever reaches a controller. Validation failures are forwarded to the
 * global error handler as a ZodError.
 */
export function validate(schema: AnyZodObject, part: RequestPart = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req[part] = schema.parse(req[part]);
      next();
    } catch (error) {
      next(error);
    }
  };
}
