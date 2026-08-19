import rateLimit from "express-rate-limit";

/**
 * Strict brute-force protection for the most sensitive endpoints
 * (login, register, checkout). Keyed by IP; returns HTTP 429 with a
 * plain JSON body once the limit is hit.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many attempts. Please try again in a few minutes.",
  },
});

/** Guards checkout creation — each attempt calls out to a paid gateway API. */
export const paymentsRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many payment attempts. Please try again in a few minutes.",
  },
});
