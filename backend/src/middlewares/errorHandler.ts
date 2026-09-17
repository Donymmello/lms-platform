import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import multer from "multer";
import { AppError } from "../errors";
import { env } from "../config/env";

/**
 * Global error-handling middleware. Every error in the application — sync
 * or async (via asyncHandler), thrown from a controller, service, or
 * middleware — ends up here. Nothing should ever escape as an unhandled
 * exception.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // Express only recognizes error middleware by arity (4 params) — `_next`
  // must stay declared even though it's unused.
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      status: "error",
      message: "Validation failed",
      details: err.flatten().fieldErrors,
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    res.status(400).json({
      status: "error",
      message: err.code === "LIMIT_FILE_SIZE" ? "The file is too large" : err.message,
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: "error",
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // Unexpected / programming error: never leak internals to the client.
  // eslint-disable-next-line no-console
  console.error("Unhandled error:", err);

  res.status(500).json({
    status: "error",
    message: "Internal server error",
    ...(env.NODE_ENV !== "production" && err instanceof Error
      ? { stack: err.stack }
      : {}),
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    status: "error",
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
}
