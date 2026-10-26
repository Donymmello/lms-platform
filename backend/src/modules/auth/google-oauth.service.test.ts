import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../../config/env";
import { googleOAuthService } from "./google-oauth.service";

const originalClientId = env.GOOGLE_CLIENT_ID;
const originalClientSecret = env.GOOGLE_CLIENT_SECRET;

beforeEach(() => {
  env.GOOGLE_CLIENT_ID = "google-client-id";
  env.GOOGLE_CLIENT_SECRET = "google-client-secret";
});

afterEach(() => {
  env.GOOGLE_CLIENT_ID = originalClientId;
  env.GOOGLE_CLIENT_SECRET = originalClientSecret;
  vi.unstubAllGlobals();
});

describe("googleOAuthService", () => {
  it("includes state, PKCE and the configured callback URL in the authorization request", () => {
    const verifier = "test-verifier";
    const url = new URL(googleOAuthService.createAuthorizationUrl("test-state", verifier));

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("state")).toBe("test-state");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:5000/api/v1/auth/google/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(
      crypto.createHash("sha256").update(verifier).digest("base64url")
    );
  });

  it("exchanges the code and accepts only a verified Google email", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "google-access-token" })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sub: "google-subject",
            email: "Student@Example.com",
            email_verified: true,
            name: "Google Student",
          })
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(googleOAuthService.getProfile("auth-code", "pkce-verifier")).resolves.toEqual({
      googleId: "google-subject",
      email: "student@example.com",
      name: "Google Student",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const tokenRequest = fetchMock.mock.calls[0]![1]!;
    expect(new URLSearchParams(tokenRequest.body as string).get("code_verifier")).toBe("pkce-verifier");
  });
});
