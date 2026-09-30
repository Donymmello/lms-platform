import { defineConfig } from "vitest/config";

/**
 * Points the suite at a dedicated `_test` database and fills in the few
 * third-party secrets whose absence would otherwise turn real assertions
 * into 503s (Bunny signed playback). `dotenv` does not overwrite variables
 * that are already set, so these win over `.env`.
 */
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://lms_user:lms_password@lms-postgres:5432/lms_db_test?schema=public";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/test/setup.ts"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: TEST_DATABASE_URL,
      TWO_FACTOR_ENCRYPTION_KEY: "0".repeat(64),
      BUNNY_STREAM_LIBRARY_ID: "12345",
      BUNNY_STREAM_API_KEY: "test-api-key",
      BUNNY_STREAM_TOKEN_AUTH_KEY: "test-token-auth-key",
    },
    /**
     * Every test file talks to the same real Postgres test database and
     * truncates it between cases, so they must not overlap. One fork, no
     * file parallelism — correctness over speed for a suite this size.
     */
    fileParallelism: false,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
