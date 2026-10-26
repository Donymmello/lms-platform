import crypto from "node:crypto";
import { AppError } from "../../errors";
import { env } from "../../config/env";

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
}

interface GoogleTokenResponse {
  access_token?: unknown;
}

interface GoogleUserInfo {
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
}

function callbackUrl(): string {
  return `${env.PUBLIC_API_URL.replace(/\/+$/, "")}/api/v1/auth/google/callback`;
}

export const googleOAuthService = {
  isConfigured(): boolean {
    return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  },

  createAuthorizationUrl(state: string, verifier: string): string {
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: callbackUrl(),
      response_type: "code",
      scope: "openid email profile",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    return url.toString();
  },

  async getProfile(code: string, verifier: string): Promise<GoogleProfile> {
    if (!this.isConfigured()) {
      throw new AppError("Google sign-in is not configured", 503);
    }

    let tokenResponse: Response;
    try {
      tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: callbackUrl(),
          grant_type: "authorization_code",
          code_verifier: verifier,
        }),
      });
    } catch {
      throw new AppError("Could not contact Google sign-in", 502);
    }
    if (!tokenResponse.ok) {
      throw new AppError("Google rejected the sign-in request", 401);
    }

    let token: GoogleTokenResponse;
    try {
      token = (await tokenResponse.json()) as GoogleTokenResponse;
    } catch {
      throw new AppError("Google returned an invalid sign-in response", 502);
    }
    if (typeof token.access_token !== "string" || !token.access_token) {
      throw new AppError("Google did not return an access token", 502);
    }

    let profileResponse: Response;
    try {
      profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
    } catch {
      throw new AppError("Could not retrieve the Google account", 502);
    }
    if (!profileResponse.ok) {
      throw new AppError("Google could not verify the account", 401);
    }

    let profile: GoogleUserInfo;
    try {
      profile = (await profileResponse.json()) as GoogleUserInfo;
    } catch {
      throw new AppError("Google returned invalid account details", 502);
    }
    if (
      typeof profile.sub !== "string" ||
      !profile.sub ||
      typeof profile.email !== "string" ||
      !profile.email ||
      profile.email_verified !== true
    ) {
      throw new AppError("Google must provide a verified email address", 401);
    }

    const email = profile.email.trim().toLowerCase();
    const name =
      typeof profile.name === "string" && profile.name.trim()
        ? profile.name.trim().slice(0, 120)
        : email.split("@")[0]!.slice(0, 120);

    return { googleId: profile.sub, email, name };
  },
};
