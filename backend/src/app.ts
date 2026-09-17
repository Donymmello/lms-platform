import express, { Express } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { analyticsRouter } from "./modules/analytics/analytics.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { usersRouter } from "./modules/users/users.routes";
import { coursesRouter } from "./modules/courses/courses.routes";
import { publicCoursesRouter } from "./modules/public-courses/public-courses.routes";
import { enrollmentsRouter } from "./modules/enrollments/enrollments.routes";
import { paymentsRouter } from "./modules/payments/payments.routes";
import { playbackRouter } from "./modules/playback/playback.routes";
import { progressRouter } from "./modules/progress/progress.routes";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";

export function createApp(): Express {
  const app = express();

  // Security headers
  app.use(helmet());

  // Only the configured frontend origin may call the API, and cookies must
  // be allowed to travel cross-origin (credentials: true) for the
  // HTTP-only auth cookies to work from the Next.js frontend.
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );

  app.use(
    express.json({
      limit: "10kb",
      // Payment webhook signatures (PaySuite's HMAC, PayPal's cert-based
      // check) are computed over the exact raw bytes the gateway sent —
      // capture them here once, for every request, since by the time a
      // route handler runs `req.body` has already been parsed/reshaped.
      verify: (req, _res, buf) => {
        (req as express.Request).rawBody = Buffer.from(buf);
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: "10kb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/users", usersRouter);
  app.use("/api/v1/courses", coursesRouter);
  app.use("/api/v1/public/courses", publicCoursesRouter);
  app.use("/api/v1/enrollments", enrollmentsRouter);
  app.use("/api/v1/payments", paymentsRouter);
  app.use("/api/v1/lessons", playbackRouter);
  app.use("/api/v1/progress", progressRouter);
  app.use("/api/v1/analytics", analyticsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
