import { Role } from "@prisma/client";

/**
 * Augments Express' Request type so `req.user` is known and strictly typed
 * everywhere after the `authenticate` middleware has run, instead of
 * falling back to `any`.
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      /** Raw request bytes, captured by express.json's `verify` hook — needed to check payment webhook signatures. */
      rawBody?: Buffer;
    }
  }
}

export interface AuthenticatedUser {
  id: string;
  role: Role;
}
