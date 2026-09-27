import path from "node:path";
import { AppError } from "../errors";

/**
 * Resolves a single file name inside a storage root, refusing anything that
 * tries to climb out of it.
 *
 * The names reach here from our own database, but treating them as untrusted
 * costs one comparison and removes a whole class of mistake — and materials
 * carry a name that started life in an upload.
 */
export function resolveInside(root: string, fileName: string): string {
  const absoluteRoot = path.resolve(root);
  const resolved = path.resolve(absoluteRoot, fileName);

  if (resolved !== path.join(absoluteRoot, path.basename(resolved))) {
    throw new AppError("Invalid file reference", 400);
  }
  return resolved;
}
