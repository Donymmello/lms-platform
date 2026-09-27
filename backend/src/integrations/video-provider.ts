import { env } from "../config/env";

/**
 * Which video backend is active. Bunny wins whenever it is configured;
 * otherwise videos live on this server's own disk.
 *
 * The choice is made per call rather than once at startup so that a
 * deployment can gain credentials without a code change, and so tests can
 * exercise both paths in one process.
 *
 * Note the two Bunny credentials are separate concerns: the management key
 * uploads, and a distinct token-auth key signs embed URLs. Both are needed
 * before the Bunny path can serve a lesson end to end, so both are checked.
 */
export function isBunnyConfigured(): boolean {
  return Boolean(
    env.BUNNY_STREAM_LIBRARY_ID && env.BUNNY_STREAM_API_KEY && env.BUNNY_STREAM_TOKEN_AUTH_KEY
  );
}
