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

export const env = clientEnvSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});
