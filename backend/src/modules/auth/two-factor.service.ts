import crypto from "node:crypto";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { AppError, ForbiddenError, UnauthorizedError } from "../../errors";
import { env } from "../../config/env";
import { comparePassword } from "../../utils/password";
import { hashToken } from "../../utils/jwt";
import { canEncryptSecrets, openSecret, sealSecret } from "../../utils/secret-box";
import { authRepository } from "./auth.repository";

/**
 * Allow the adjacent 30-second windows. Phone clocks drift, and a code typed
 * as one window closes would otherwise be rejected for no reason the user can
 * see. One step either side is the usual compromise between that and leaving
 * a code valid for too long.
 */
authenticator.options = { window: 1 };

const RECOVERY_CODE_COUNT = 8;

/** Ambiguous characters are left out: these get written down and typed back by hand. */
const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newRecoveryCode(): string {
  const bytes = crypto.randomBytes(10);
  const body = [...bytes].map((byte) => RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length]).join("");
  return `${body.slice(0, 5)}-${body.slice(5, 10)}`;
}

/** Codes are compared case-insensitively and without the dash, so what the user types is forgiving. */
function normaliseRecoveryCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export interface TwoFactorSetup {
  /** `otpauth://` URI, for anyone who prefers to add the account by hand. */
  otpauthUrl: string;
  /** PNG data URL of the same URI, ready to drop into an <img>. */
  qrCodeDataUrl: string;
}

export const twoFactorService = {
  /**
   * Step one of enrolment: generate a secret and show it. Nothing is enabled
   * yet — `twoFactorEnabledAt` stays null until a code proves the device
   * actually holds the secret, so a half-finished enrolment cannot lock
   * anyone out of their own account.
   */
  async beginEnrolment(userId: string): Promise<TwoFactorSetup> {
    if (!canEncryptSecrets()) {
      throw new AppError("Two-factor authentication is not configured on this server", 503);
    }

    const user = await authRepository.findById(userId);
    if (!user) throw new UnauthorizedError("Authentication required");
    if (user.twoFactorEnabledAt) {
      throw new ForbiddenError("Two-factor authentication is already enabled");
    }

    const secret = authenticator.generateSecret();
    await authRepository.setTwoFactorSecret(userId, sealSecret(secret));

    const otpauthUrl = authenticator.keyuri(user.email, env.TWO_FACTOR_ISSUER, secret);
    return { otpauthUrl, qrCodeDataUrl: await QRCode.toDataURL(otpauthUrl) };
  },

  /**
   * Step two: a valid code switches it on and returns the recovery codes.
   * They are shown exactly once — only their hashes are kept — so the
   * response is the user's single chance to save them.
   */
  async confirmEnrolment(userId: string, code: string): Promise<string[]> {
    const user = await authRepository.findById(userId);
    if (!user?.twoFactorSecret) {
      throw new ForbiddenError("Start by generating a two-factor secret");
    }
    if (user.twoFactorEnabledAt) {
      throw new ForbiddenError("Two-factor authentication is already enabled");
    }
    if (!authenticator.check(code.trim(), openSecret(user.twoFactorSecret))) {
      throw new UnauthorizedError("That code is not valid");
    }

    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, newRecoveryCode);
    await authRepository.replaceRecoveryCodes(
      userId,
      codes.map((value) => hashToken(normaliseRecoveryCode(value)))
    );
    await authRepository.enableTwoFactor(userId);

    return codes;
  },

  /**
   * Checks a code during sign-in. Accepts either a TOTP code or one of the
   * recovery codes; a recovery code is spent in the process, so the same slip
   * of paper cannot be reused.
   */
  async verifyCode(userId: string, code: string): Promise<void> {
    const user = await authRepository.findById(userId);
    if (!user?.twoFactorSecret || !user.twoFactorEnabledAt) {
      throw new UnauthorizedError("Two-factor authentication is not enabled for this account");
    }

    if (authenticator.check(code.trim(), openSecret(user.twoFactorSecret))) return;

    const recovery = await authRepository.findUnusedRecoveryCode(
      userId,
      hashToken(normaliseRecoveryCode(code))
    );
    if (!recovery) {
      throw new UnauthorizedError("That code is not valid");
    }

    await authRepository.markRecoveryCodeUsed(recovery.id);
  },

  /**
   * Turning it off needs the password as well as a current code: knowing one
   * of the two is exactly the situation 2FA exists to survive.
   */
  async disable(userId: string, password: string, code: string): Promise<void> {
    const user = await authRepository.findById(userId);
    if (!user?.twoFactorEnabledAt) {
      throw new ForbiddenError("Two-factor authentication is not enabled");
    }
    if (!(await comparePassword(password, user.password))) {
      throw new UnauthorizedError("Incorrect password");
    }

    await this.verifyCode(userId, code);
    await authRepository.disableTwoFactor(userId);
  },

  async countUnusedRecoveryCodes(userId: string): Promise<number> {
    return authRepository.countUnusedRecoveryCodes(userId);
  },
};
