import { Role } from "@prisma/client";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "../../constants/cookies";
import { authCookie, createUser, TEST_PASSWORD } from "../../test/factories";

const app = createApp();

function cookieNames(response: request.Response): string[] {
  const raw = response.headers["set-cookie"];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((cookie) => cookie.split("=")[0]!);
}

/**
 * `authRateLimiter` allows 10 requests per IP per 15 minutes and keeps its
 * counters in memory for the life of the process, so every `/auth/*` call in
 * this file shares one budget. The cases below stay under it, and the
 * deliberate 429 test is last on purpose — anything added after it would
 * start from an exhausted budget.
 */
describe("POST /auth/register", () => {
  it("creates a STUDENT and sets both auth cookies, never returning the password", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      name: "Ana Silva",
      email: "ana@example.test",
      password: "Str0ngPass",
    });

    expect(response.status).toBe(201);
    expect(response.body.data.user).toMatchObject({ email: "ana@example.test", role: Role.STUDENT });
    expect(response.body.data.user.password).toBeUndefined();
    expect(cookieNames(response)).toEqual(
      expect.arrayContaining([ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE])
    );
  });

  it("rejects a duplicate email with 409", async () => {
    await createUser({ email: "taken@example.test" });

    const response = await request(app).post("/api/v1/auth/register").send({
      name: "Someone Else",
      email: "taken@example.test",
      password: "Str0ngPass",
    });

    expect(response.status).toBe(409);
  });

  it("rejects a password that fails the complexity rules", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      name: "Weak Password",
      email: "weak@example.test",
      password: "alllowercase",
    });

    expect(response.status).toBe(400);
  });
});

describe("POST /auth/login", () => {
  it("signs in with the right credentials", async () => {
    const user = await createUser({ email: "login@example.test" });

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "login@example.test", password: TEST_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.data.user.id).toBe(user.id);
    expect(cookieNames(response)).toEqual(
      expect.arrayContaining([ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE])
    );
  });

  it("gives the same 401 for a wrong password as for an unknown email", async () => {
    await createUser({ email: "known@example.test" });

    const wrongPassword = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "known@example.test", password: "Wr0ngPassword" });
    const unknownEmail = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nobody@example.test", password: TEST_PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    // Identical wording, so the response cannot be used to enumerate accounts.
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });

  it("blocks a deactivated account", async () => {
    await createUser({ email: "gone@example.test", isActive: false });

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "gone@example.test", password: TEST_PASSWORD });

    expect(response.status).toBe(403);
  });
});

describe("GET /auth/me", () => {
  it("returns the current user for a valid session", async () => {
    const user = await createUser({ role: Role.INSTRUCTOR });

    const response = await request(app).get("/api/v1/auth/me").set("Cookie", authCookie(user));

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({ id: user.id, role: Role.INSTRUCTOR });
  });

  it("rejects a request with no cookie", async () => {
    const response = await request(app).get("/api/v1/auth/me");
    expect(response.status).toBe(401);
  });

  it("rejects a token signed with the wrong secret", async () => {
    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", `${ACCESS_TOKEN_COOKIE}=not.a.valid.jwt`);

    expect(response.status).toBe(401);
  });
});

describe("POST /auth/logout", () => {
  it("clears both auth cookies", async () => {
    const user = await createUser();

    const response = await request(app).post("/api/v1/auth/logout").set("Cookie", authCookie(user));

    expect(response.status).toBe(200);
    const cleared = response.headers["set-cookie"] as unknown as string[];
    expect(cleared.join(";")).toContain(ACCESS_TOKEN_COOKIE);
  });
});

// Keep last — see the note at the top of this file.
describe("auth rate limiting", () => {
  it("returns 429 once the per-IP budget is spent", async () => {
    let lastStatus = 0;

    // The budget is already partly used by the cases above; 15 attempts is
    // comfortably past the limit of 10 without depending on the exact count.
    for (let attempt = 0; attempt < 15; attempt += 1) {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "nobody@example.test", password: "Wr0ngPassword" });
      lastStatus = response.status;
      if (lastStatus === 429) break;
    }

    expect(lastStatus).toBe(429);
  });
});
