import express, { Express } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { auditContext } from "./middlewares/auditContext";
import { auditRouter } from "./modules/audit/audit.routes";
import { generalRateLimiter } from "./middlewares/rateLimiter";
import { analyticsRouter } from "./modules/analytics/analytics.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { usersRouter } from "./modules/users/users.routes";
import { coursesRouter } from "./modules/courses/courses.routes";
import { publicCoursesRouter } from "./modules/public-courses/public-courses.routes";
import { publicCoversRouter } from "./modules/public-courses/public-covers.routes";
import { enrollmentsRouter } from "./modules/enrollments/enrollments.routes";
import { liveSessionsRouter } from "./modules/live-sessions/live-sessions.routes";
import { paymentsRouter } from "./modules/payments/payments.routes";
import { playbackRouter } from "./modules/playback/playback.routes";
import { assessmentsRouter } from "./modules/assessments/assessments.routes";
import { progressRouter } from "./modules/progress/progress.routes";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";

export function createApp(): Express {
  const app = express();

  /*
   * Behind a reverse proxy, req.ip is the proxy's address unless Express is
   * told to read X-Forwarded-For. That is not cosmetic: the rate limiters are
   * keyed by IP, so without this every request in the world shares one
   * counter, and ten failed logins from anyone lock out everybody. The
   * defence turns into a denial of service against its own users.
   *
   * "uniquelocal" trusts hops from loopback and private ranges, which is
   * exactly the container chain (this app, its own proxy, and whatever proxy
   * the host already runs) and never a client on the public internet. It is
   * right for one hop or three without a magic number to keep in step with
   * the deployment, and harmless in development where there is no proxy and
   * no X-Forwarded-For to read.
   *
   * Safe because the backend publishes no port in production: only the proxy
   * can reach it, so nothing else is in a position to forge the header.
   */
  app.set("trust proxy", "uniquelocal");

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

  // After the body parsers so a rejected request still costs the client its
  // slot, and before the routes so every one of them is covered.
  app.use(generalRateLimiter);

  // Carries the acting user and their address for the request, so an audit
  // entry written deep in a service does not need them as arguments.
  app.use(auditContext);

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/users", usersRouter);
  app.use("/api/v1/courses", coursesRouter);
  app.use("/api/v1/public/courses", publicCoursesRouter);
  app.use("/api/v1/public/covers", publicCoversRouter);
  app.use("/api/v1/enrollments", enrollmentsRouter);
  app.use("/api/v1/payments", paymentsRouter);
  app.use("/api/v1/lessons", playbackRouter);
  app.use("/api/v1/progress", progressRouter);
  app.use("/api/v1/modules", assessmentsRouter);
  app.use("/api/v1/analytics", analyticsRouter);
  app.use("/api/v1/audit", auditRouter);
  app.use("/api/v1/live-sessions", liveSessionsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
