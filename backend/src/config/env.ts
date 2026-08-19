import "dotenv/config";
import { z } from "zod";

/**
 * All environment variables the application depends on are validated here,
 * once, at startup. If anything is missing or malformed the process exits
 * immediately with a clear error instead of failing later at an
 * unpredictable point in request handling.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),

  DATABASE_URL: z.string().url({ message: "DATABASE_URL must be a valid connection string" }),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  CORS_ORIGIN: z.string().min(1, "CORS_ORIGIN is required"),
  COOKIE_DOMAIN: z.string().optional(),

  // Used to build absolute return/webhook URLs handed to payment gateways
  // (they can't resolve relative paths). No sensible default in production.
  PUBLIC_API_URL: z.string().url().default("http://localhost:5000"),
  PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  // --- PaySuite (M-Pesa + e-Mola aggregator for Mozambique) ---
  // https://paysuite.tech/docs — one gateway, `method: "mpesa" | "emola"`
  // selects the rail per checkout. Left with dev-only defaults so the app
  // boots without them; real payments will fail fast with a clear error
  // (see paysuite.provider.ts) until they're set.
  PAYSUITE_BASE_URL: z.string().url().default("https://paysuite.tech/api/v1"),
  PAYSUITE_API_KEY: z.string().default(""),
  PAYSUITE_WEBHOOK_SECRET: z.string().default(""),

  // --- PayPal (Orders v2 REST API) ---
  PAYPAL_BASE_URL: z.string().url().default("https://api-m.sandbox.paypal.com"),
  PAYPAL_CLIENT_ID: z.string().default(""),
  PAYPAL_CLIENT_SECRET: z.string().default(""),
  // Webhook ID from the PayPal app's "Webhooks" tab — required to verify
  // that an incoming webhook call really came from PayPal.
  PAYPAL_WEBHOOK_ID: z.string().default(""),
  // PayPal does not support MZN as a transaction currency, so priced
  // courses (stored in MZN cents) are converted to this currency for the
  // PayPal leg only. The rate is a static env var, not a live FX lookup —
  // fine for now, but replace with a real FX source before going live.
  PAYPAL_CURRENCY: z.string().default("USD"),
  PAYPAL_MZN_PER_USD_RATE: z.coerce.number().positive().default(64),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error("❌ Invalid environment variables:");
    // eslint-disable-next-line no-console
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();
