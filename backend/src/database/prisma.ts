import { PrismaClient } from "@prisma/client";
import { env } from "../config/env";

/**
 * Single shared PrismaClient instance for the whole process.
 * Re-instantiating PrismaClient per request (or per hot-reload in dev)
 * exhausts database connections, so it is created once here and imported
 * everywhere else via `import { prisma } from "../../database/prisma"`.
 */
export const prisma = new PrismaClient({
  log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
