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
 * Registration, tighter than the rest and for a specific reason: every
 * successful signup sends a welcome email to whatever address was typed. A
 * script registering someone else's address repeatedly turns this app into a
 * way to mail-bomb them, and that is abuse we would be doing, not receiving.
 *
 * Five an hour is generous for a real person — nobody signs up twice — and
 * makes that amplification worthless from one address. It does not stop a
 * script with a pool of IPs: the control for that is verifying the address
 * before the account works, which needs mail that actually gets delivered.
 */
const registerStore = new MemoryStore();

export const registerRateLimiter = rateLimit({
  store: registerStore,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many accounts created from here. Please try again later.",
  },
});

/**
 * A ceiling for everything else, which had none: before this, only login and
 * checkout were limited, so anything reachable without a session — the
 * catalogue, a course page, a free-preview video — could be hammered as fast
 * as the network allowed.
 *
 * Deliberately loose. Opening one course page is already a handful of
 * requests, and a student moving through a lesson makes more, so this is set
 * to catch a script rather than to shape normal use. The stricter limits on
 * the sensitive routes still apply on top of it.
 */
const generalStore = new MemoryStore();

export const generalRateLimiter = rateLimit({
  store: generalStore,
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  // Health checks are what a monitor or an orchestrator polls; counting them
  // would make the platform's own uptime probe eat a visitor's budget.
  skip: (req) => req.path === "/health",
  message: {
    status: "error",
    message: "Too many requests. Please slow down.",
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
  registerStore.resetAll();
  generalStore.resetAll();
}
