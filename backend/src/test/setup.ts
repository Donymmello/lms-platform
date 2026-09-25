import { afterAll, beforeEach } from "vitest";
import { prisma } from "../database/prisma";

/**
 * Hard guard against pointing the suite at a real database: every test
 * truncates every table, so running with the dev (or worse, production)
 * DATABASE_URL would wipe it. The URL must name a database whose name ends
 * in `_test`.
 */
const databaseName = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/none").pathname.replace("/", "");

if (!databaseName.endsWith("_test")) {
  throw new Error(
    `Refusing to run tests against database "${databaseName}". ` +
      `DATABASE_URL must point at a database whose name ends in "_test".`
  );
}

/**
 * Emptied children-first so foreign keys are never violated, and a test
 * never inherits rows from the one before it. `_prisma_migrations` is
 * deliberately left alone — wiping it would make Prisma think the schema was
 * never applied.
 *
 * `DELETE`, not `TRUNCATE`: on this Docker/WSL Postgres a TRUNCATE of these
 * tables costs ~3s (it rewrites relation files and fsyncs), which dominated
 * the whole suite. DELETE on a handful of test rows is ~10ms, and there are
 * no sequences to restart because every primary key is a uuid.
 */
const TABLES = [
  "lesson_progress",
  "live_sessions",
  "enrollments",
  "payments",
  "lessons",
  "course_modules",
  "courses",
  "refresh_tokens",
  "users",
];

beforeEach(async () => {
  await prisma.$transaction(
    TABLES.map((table) => prisma.$executeRawUnsafe(`DELETE FROM "${table}"`))
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});
