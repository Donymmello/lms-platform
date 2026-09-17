import { z } from "zod";

/**
 * Only NEXT_PUBLIC_* variables are available in the browser bundle, so this
 * is the full (small) set of client-safe config. Validated once at import
 * time so a missing/malformed value fails loudly instead of causing a
 * confusing runtime fetch error later.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
});

/**
 * Server-only override, read straight from `process.env` (never exposed to
 * the browser bundle since it isn't NEXT_PUBLIC_-prefixed). Inside Docker
 * Compose the frontend and backend are separate containers — `localhost`
 * from code running inside the frontend container means the frontend
 * container itself, not the backend, so Server Components/route handlers
 * that fetch during SSR need the backend's Docker-network hostname
 * (`http://backend:5000/...`) instead. Optional and unused outside Docker,
 * where server and browser can both reach the backend the same way.
 */
const serverEnvSchema = z.object({
  INTERNAL_API_URL: z.string().url().optional(),
});

const publicEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});

const serverEnv = serverEnvSchema.parse({
  INTERNAL_API_URL: process.env.INTERNAL_API_URL,
});

export const env = {
  NEXT_PUBLIC_API_URL: publicEnv.NEXT_PUBLIC_API_URL,
  INTERNAL_API_URL: serverEnv.INTERNAL_API_URL,
};
