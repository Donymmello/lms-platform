import crypto from "node:crypto";
import { AppError } from "../errors";
import { env } from "../config/env";

/**
 * Authenticated symmetric encryption for secrets that have to be read back —
 * currently the TOTP shared secret, which cannot be hashed because generating
 * a code requires the original value.
 *
 * AES-256-GCM, with a random 12-byte IV per message and the auth tag stored
 * alongside. The tag is what makes this different from plain encryption: a
 * tampered ciphertext fails to decrypt instead of silently producing garbage
 * that would then be used to validate login codes.
 *
 * The key lives in the environment, never in the database, so a stolen dump
 * leaves the secrets unreadable.
 */

const IV_BYTES = 12;
const KEY_BYTES = 32;

function getKey(): Buffer {
  const raw = env.TWO_FACTOR_ENCRYPTION_KEY;
  if (!raw) {
    throw new AppError("Two-factor authentication is not configured (missing TWO_FACTOR_ENCRYPTION_KEY)", 503);
  }

  const key = Buffer.from(raw, "hex");
  if (key.length !== KEY_BYTES) {
    throw new AppError(
      `TWO_FACTOR_ENCRYPTION_KEY must be ${KEY_BYTES} bytes of hex (${KEY_BYTES * 2} characters)`,
      500
    );
  }
  return key;
}

/** True when a key is configured, so callers can refuse enrolment up front rather than mid-flow. */
export function canEncryptSecrets(): boolean {
  return Boolean(env.TWO_FACTOR_ENCRYPTION_KEY);
}

/** Returns `iv:tag:ciphertext`, all hex — one self-contained string to store in a column. */
export function sealSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return [iv.toString("hex"), cipher.getAuthTag().toString("hex"), ciphertext.toString("hex")].join(":");
}

export function openSecret(sealed: string): string {
  const [ivHex, tagHex, dataHex] = sealed.split(":");
  if (!ivHex || !tagHex || !dataHex) {
    throw new AppError("Stored two-factor secret is malformed", 500);
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));

  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
}
