import rateLimit, { MemoryStore } from "express-rate-limit";

/**
 * Strict brute-force protection for the most sensitive endpoints
 * (login, register, checkout). Keyed by IP; returns HTTP 429 with a
 * plain JSON body once the limit is hit.
 */
const authStore = new MemoryStore();
const paymentsStore = new MemoryStore();

export const authRateLimiter = rateLimit({
  store: authStore,
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
  store: paymentsStore,
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many payment attempts. Please try again in a few minutes.",
  },
});

/**
 * Clears every counter. Test-only: the limiters are module-level singletons
 * keyed by IP, so without this one test file's requests eat the next one's
 * budget and unrelated assertions start seeing 429. Production never calls it.
 */
export function resetRateLimiters(): void {
  authStore.resetAll();
  paymentsStore.resetAll();
}
