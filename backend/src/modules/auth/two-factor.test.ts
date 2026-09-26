import { authenticator } from "otplib";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { ACCESS_TOKEN_COOKIE } from "../../constants/cookies";
import { prisma } from "../../database/prisma";
import { openSecret } from "../../utils/secret-box";
import { authCookie, createUser, TEST_PASSWORD } from "../../test/factories";

const app = createApp();

/** Walks a user all the way through enrolment and hands back what is needed to sign in. */
async function enrol(overrides: Parameters<typeof createUser>[0] = {}) {
  const user = await createUser(overrides);
  const cookie = authCookie(user);

  await request(app).post("/api/v1/auth/two-factor/setup").set("Cookie", cookie);

  const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const secret = openSecret(stored.twoFactorSecret!);

  const enabled = await request(app)
    .post("/api/v1/auth/two-factor/enable")
    .set("Cookie", cookie)
    .send({ code: authenticator.generate(secret) });

  return { user, cookie, secret, recoveryCodes: enabled.body.data.recoveryCodes as string[] };
}

function login(email: string, password = TEST_PASSWORD) {
  return request(app).post("/api/v1/auth/login").send({ email, password });
}

describe("enrolment", () => {
  it("returns a QR code and stores the secret encrypted, without enabling anything yet", async () => {
    const user = await createUser();

    const response = await request(app)
      .post("/api/v1/auth/two-factor/setup")
      .set("Cookie", authCookie(user));

    expect(response.status).toBe(200);
    expect(response.body.data.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(response.body.data.otpauthUrl).toContain("otpauth://totp/");

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    // Not enabled until a code proves the device holds the secret.
    expect(stored.twoFactorEnabledAt).toBeNull();
    // Stored as iv:tag:ciphertext, never as the raw base32 secret.
    expect(stored.twoFactorSecret).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
    expect(stored.twoFactorSecret).not.toContain(response.body.data.otpauthUrl.split("secret=")[1]);
  });

  it("enables on a valid code and returns recovery codes only once", async () => {
    const { user, recoveryCodes } = await enrol();

    expect(recoveryCodes).toHaveLength(8);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.twoFactorEnabledAt).not.toBeNull();

    // Only hashes are kept, so the plain codes cannot be recovered from the database.
    const rows = await prisma.twoFactorRecoveryCode.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(8);
    for (const code of recoveryCodes) {
      expect(rows.some((row) => row.codeHash === code)).toBe(false);
    }
  });

  it("refuses to enable on a wrong code", async () => {
    const user = await createUser();
    const cookie = authCookie(user);
    await request(app).post("/api/v1/auth/two-factor/setup").set("Cookie", cookie);

    const response = await request(app)
      .post("/api/v1/auth/two-factor/enable")
      .set("Cookie", cookie)
      .send({ code: "000000" });

    expect(response.status).toBe(401);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.twoFactorEnabledAt).toBeNull();
  });

  it("requires a session to start enrolment", async () => {
    const response = await request(app).post("/api/v1/auth/two-factor/setup");
    expect(response.status).toBe(401);
  });
});

describe("signing in", () => {
  it("withholds the session until a code is given", async () => {
    const { user } = await enrol({ email: "comdois@example.test" });

    const response = await login("comdois@example.test");

    expect(response.status).toBe(200);
    expect(response.body.data.requiresTwoFactor).toBe(true);
    expect(response.body.data.challengeToken).toBeTruthy();
    // The password alone must not produce a session.
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(response.body.data.user).toBeUndefined();
    expect(user.id).toBeTruthy();
  });

  it("exchanges a challenge plus a code for a session", async () => {
    const { secret } = await enrol({ email: "troca@example.test" });
    const challengeToken = (await login("troca@example.test")).body.data.challengeToken;

    const response = await request(app)
      .post("/api/v1/auth/two-factor/verify")
      .send({ challengeToken, code: authenticator.generate(secret) });

    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe("troca@example.test");
    expect(String(response.headers["set-cookie"])).toContain(ACCESS_TOKEN_COOKIE);
  });

  it("REFUSES a challenge token presented as a session cookie", async () => {
    await enrol({ email: "ataque@example.test" });
    const challengeToken = (await login("ataque@example.test")).body.data.challengeToken;

    // Signed with the same secret as an access token. Without the `purpose`
    // check this would authenticate and skip the second factor completely.
    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", `${ACCESS_TOKEN_COOKIE}=${challengeToken}`);

    expect(response.status).toBe(401);
  });

  it("refuses a session cookie presented as a challenge", async () => {
    const { user, secret } = await enrol({ email: "inverso@example.test" });

    const response = await request(app)
      .post("/api/v1/auth/two-factor/verify")
      .send({
        challengeToken: authCookie(user).split("=")[1],
        code: authenticator.generate(secret),
      });

    expect(response.status).toBe(401);
  });

  it("refuses a wrong code, and the account stays locked", async () => {
    await enrol({ email: "errado@example.test" });
    const challengeToken = (await login("errado@example.test")).body.data.challengeToken;

    const response = await request(app)
      .post("/api/v1/auth/two-factor/verify")
      .send({ challengeToken, code: "000000" });

    expect(response.status).toBe(401);
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("still refuses the wrong password before any code is involved", async () => {
    await enrol({ email: "password@example.test" });

    const response = await login("password@example.test", "PasswordErrada9");

    expect(response.status).toBe(401);
    expect(response.body.data).toBeUndefined();
  });

  it("leaves accounts without 2FA signing in exactly as before", async () => {
    await createUser({ email: "semdois@example.test" });

    const response = await login("semdois@example.test");

    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe("semdois@example.test");
    expect(String(response.headers["set-cookie"])).toContain(ACCESS_TOKEN_COOKIE);
  });
});

describe("recovery codes", () => {
  it("lets one stand in for the app, and spends it", async () => {
    const { user, recoveryCodes } = await enrol({ email: "recupera@example.test" });
    const challengeToken = (await login("recupera@example.test")).body.data.challengeToken;

    const response = await request(app)
      .post("/api/v1/auth/two-factor/verify")
      .send({ challengeToken, code: recoveryCodes[0] });

    expect(response.status).toBe(200);
    expect(await prisma.twoFactorRecoveryCode.count({ where: { userId: user.id, usedAt: null } })).toBe(7);
  });

  it("will not accept the same code twice", async () => {
    const { recoveryCodes } = await enrol({ email: "duasvezes@example.test" });

    const first = (await login("duasvezes@example.test")).body.data.challengeToken;
    await request(app).post("/api/v1/auth/two-factor/verify").send({ challengeToken: first, code: recoveryCodes[0] });

    const second = (await login("duasvezes@example.test")).body.data.challengeToken;
    const response = await request(app)
      .post("/api/v1/auth/two-factor/verify")
      .send({ challengeToken: second, code: recoveryCodes[0] });

    expect(response.status).toBe(401);
  });

  it("accepts a code typed without its dash and in lower case", async () => {
    const { recoveryCodes } = await enrol({ email: "formato@example.test" });
    const challengeToken = (await login("formato@example.test")).body.data.challengeToken;

    const response = await request(app)
      .post("/api/v1/auth/two-factor/verify")
      .send({ challengeToken, code: recoveryCodes[0]!.replace("-", "").toLowerCase() });

    expect(response.status).toBe(200);
  });
});

describe("turning it off", () => {
  it("needs both the password and a current code", async () => {
    const { user, cookie, secret } = await enrol({ email: "desligar@example.test" });

    const withoutPassword = await request(app)
      .post("/api/v1/auth/two-factor/disable")
      .set("Cookie", cookie)
      .send({ password: "PasswordErrada9", code: authenticator.generate(secret) });
    const withoutCode = await request(app)
      .post("/api/v1/auth/two-factor/disable")
      .set("Cookie", cookie)
      .send({ password: TEST_PASSWORD, code: "000000" });

    expect(withoutPassword.status).toBe(401);
    expect(withoutCode.status).toBe(401);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).twoFactorEnabledAt).not.toBeNull();
  });

  it("clears the secret and the recovery codes, so re-enabling starts fresh", async () => {
    const { user, cookie, secret } = await enrol({ email: "limpa@example.test" });

    const response = await request(app)
      .post("/api/v1/auth/two-factor/disable")
      .set("Cookie", cookie)
      .send({ password: TEST_PASSWORD, code: authenticator.generate(secret) });

    expect(response.status).toBe(200);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.twoFactorEnabledAt).toBeNull();
    expect(stored.twoFactorSecret).toBeNull();
    expect(await prisma.twoFactorRecoveryCode.count({ where: { userId: user.id } })).toBe(0);

    // And login goes back to one step.
    const after = await login("limpa@example.test");
    expect(after.body.data.user.email).toBe("limpa@example.test");
  });
});
