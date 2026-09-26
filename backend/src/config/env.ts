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

  // --- Two-factor authentication ---
  // 32 bytes of hex. Encrypts the TOTP secrets at rest so a stolen database
  // dump cannot be used to mint login codes. Empty disables enrolment: the
  // app still boots and anyone who already has 2FA keeps working, but nobody
  // new can turn it on. Generate one with:
  //   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  TWO_FACTOR_ENCRYPTION_KEY: z.string().default(""),
  /// Shown as the account name in the authenticator app.
  TWO_FACTOR_ISSUER: z.string().default("Estudio"),

  // --- Outgoing email (SMTP) ---
  // Plain SMTP rather than one vendor's SDK, so the same code works with a
  // mail catcher in dev and with Gmail, cPanel, Resend or SendGrid in
  // production — all of them speak SMTP. Leaving SMTP_HOST empty disables
  // sending entirely: the app still runs and every notification becomes a
  // no-op (see integrations/mailer.ts), which is what tests and a fresh
  // checkout want.
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().default(""),
  SMTP_PASSWORD: z.string().default(""),
  /// True for port 465 (implicit TLS). Port 587 and the dev catcher use STARTTLS or nothing.
  /// Not `z.coerce.boolean()`: that is `Boolean(value)`, so the string
  /// "false" would come out as true and force TLS onto a plaintext port.
  SMTP_SECURE: z
    .string()
    .default("false")
    .transform((value) => value.trim().toLowerCase() === "true"),
  MAIL_FROM: z.string().default("Estúdio <nao-responder@localhost>"),

  // --- Bunny Stream (video hosting + signed playback) ---
  // https://bunny.net/docs/stream/ — create a Stream library in the
  // dashboard to get the library id, API key (management API) and the
  // separate "Token Authentication Key" (embed URL signing, found under the
  // library's security settings — NOT the same as the API key).
  BUNNY_STREAM_BASE_URL: z.string().url().default("https://video.bunnycdn.com"),
  BUNNY_STREAM_LIBRARY_ID: z.string().default(""),
  BUNNY_STREAM_API_KEY: z.string().default(""),
  BUNNY_STREAM_TOKEN_AUTH_KEY: z.string().default(""),
  // How long a signed embed URL stays valid once issued.
  BUNNY_STREAM_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
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
