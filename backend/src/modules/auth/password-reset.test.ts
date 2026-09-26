import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../database/prisma";
import { hashToken } from "../../utils/jwt";
import { comparePassword } from "../../utils/password";
import { createUser, TEST_PASSWORD } from "../../test/factories";

const mailerMock = vi.hoisted(() => ({
  send: vi.fn(),
  isEnabled: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("../../integrations/mailer", () => ({ mailer: mailerMock }));

const app = createApp();

const NEW_PASSWORD = "N0vaPassword";

beforeEach(() => {
  vi.clearAllMocks();
  mailerMock.isEnabled.mockReturnValue(true);
  mailerMock.send.mockResolvedValue(undefined);
});

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 50));
}

/** Digs the raw token out of the link in the email that was sent. */
function tokenFromEmail(): string {
  const mail = mailerMock.send.mock.calls.at(-1)?.[0] as { text: string } | undefined;
  const match = mail?.text.match(/token=([a-f0-9]+)/);
  if (!match) throw new Error("No reset token in the sent email");
  return match[1]!;
}

async function requestReset(email: string): Promise<request.Response> {
  return request(app).post("/api/v1/auth/forgot-password").send({ email });
}

describe("POST /auth/forgot-password", () => {
  it("emails a link to a real account", async () => {
    const user = await createUser({ email: "quem@example.test", name: "Quem" });

    const response = await requestReset("quem@example.test");
    await settle();

    expect(response.status).toBe(200);
    expect(mailerMock.send).toHaveBeenCalledTimes(1);

    const stored = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });
    // The raw token lives only in the email; the row holds its hash.
    expect(stored.tokenHash).toBe(hashToken(tokenFromEmail()));
    expect(stored.tokenHash).not.toBe(tokenFromEmail());
    expect(stored.usedAt).toBeNull();
  });

  it("answers identically for an address that has no account, and sends nothing", async () => {
    await createUser({ email: "existe@example.test" });

    const known = await requestReset("existe@example.test");
    const unknown = await requestReset("ninguem@example.test");
    await settle();

    // Same status and same body, or this endpoint becomes a way to mine
    // which addresses are registered.
    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);
    expect(mailerMock.send).toHaveBeenCalledTimes(1);
    expect(await prisma.passwordResetToken.count()).toBe(1);
  });

  it("ignores a deactivated account", async () => {
    await createUser({ email: "desativado@example.test", isActive: false });

    const response = await requestReset("desativado@example.test");
    await settle();

    expect(response.status).toBe(200);
    expect(mailerMock.send).not.toHaveBeenCalled();
    expect(await prisma.passwordResetToken.count()).toBe(0);
  });

  it("retires the previous link when a new one is requested", async () => {
    await createUser({ email: "duas@example.test" });

    await requestReset("duas@example.test");
    await settle();
    const firstToken = tokenFromEmail();

    await requestReset("duas@example.test");
    await settle();
    const secondToken = tokenFromEmail();

    expect(firstToken).not.toBe(secondToken);
    expect(await prisma.passwordResetToken.count()).toBe(1);

    // Only the newest email works.
    const stale = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: firstToken, password: NEW_PASSWORD });
    expect(stale.status).toBe(401);
  });

  it("rejects a malformed email without creating anything", async () => {
    const response = await requestReset("nao-e-um-email");

    expect(response.status).toBe(400);
    expect(await prisma.passwordResetToken.count()).toBe(0);
  });
});

describe("POST /auth/reset-password", () => {
  async function tokenFor(email: string): Promise<string> {
    await createUser({ email });
    await requestReset(email);
    await settle();
    return tokenFromEmail();
  }

  it("sets the new password, and the old one stops working", async () => {
    const token = await tokenFor("troca@example.test");

    const reset = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token, password: NEW_PASSWORD });
    expect(reset.status).toBe(200);

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: "troca@example.test" } });
    expect(await comparePassword(NEW_PASSWORD, stored.password)).toBe(true);
    expect(await comparePassword(TEST_PASSWORD, stored.password)).toBe(false);

    const withNew = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "troca@example.test", password: NEW_PASSWORD });
    const withOld = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "troca@example.test", password: TEST_PASSWORD });

    expect(withNew.status).toBe(200);
    expect(withOld.status).toBe(401);
  });

  it("can only be redeemed once", async () => {
    const token = await tokenFor("uma-vez@example.test");

    const first = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token, password: NEW_PASSWORD });
    const second = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token, password: "OutraPass9" });

    expect(first.status).toBe(200);
    expect(second.status).toBe(401);

    // The second attempt must not have taken effect.
    const stored = await prisma.user.findUniqueOrThrow({ where: { email: "uma-vez@example.test" } });
    expect(await comparePassword(NEW_PASSWORD, stored.password)).toBe(true);
  });

  it("rejects an expired token", async () => {
    const token = await tokenFor("expirado@example.test");
    await prisma.passwordResetToken.updateMany({
      where: { tokenHash: hashToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token, password: NEW_PASSWORD });

    expect(response.status).toBe(401);
    const stored = await prisma.user.findUniqueOrThrow({ where: { email: "expirado@example.test" } });
    expect(await comparePassword(TEST_PASSWORD, stored.password)).toBe(true);
  });

  it("rejects a token that was never issued", async () => {
    await createUser({ email: "inventado@example.test" });

    const response = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: "a".repeat(64), password: NEW_PASSWORD });

    expect(response.status).toBe(401);
  });

  it("gives the same answer for expired, spent and never-issued tokens", async () => {
    const spent = await tokenFor("gasto@example.test");
    await request(app).post("/api/v1/auth/reset-password").send({ token: spent, password: NEW_PASSWORD });

    const expired = await tokenFor("velho@example.test");
    await prisma.passwordResetToken.updateMany({
      where: { tokenHash: hashToken(expired) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const answers = await Promise.all(
      [spent, expired, "b".repeat(64)].map((token) =>
        request(app).post("/api/v1/auth/reset-password").send({ token, password: "MaisUma9" })
      )
    );

    // Probing must not distinguish why a token failed.
    const shapes = answers.map((r) => `${r.status}:${JSON.stringify(r.body)}`);
    expect(new Set(shapes).size).toBe(1);
  });

  it("kills every existing session, because a reset often means the account was taken", async () => {
    const email = "sessoes@example.test";
    await createUser({ email });

    // Two live sessions before the reset.
    await request(app).post("/api/v1/auth/login").send({ email, password: TEST_PASSWORD });
    await request(app).post("/api/v1/auth/login").send({ email, password: TEST_PASSWORD });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(await prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } })).toBe(2);

    await requestReset(email);
    await settle();
    await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: tokenFromEmail(), password: NEW_PASSWORD });

    expect(await prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
  });

  it("holds the new password to the same rules as registration", async () => {
    const token = await tokenFor("fraca@example.test");

    const response = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token, password: "minusculas" });

    expect(response.status).toBe(400);
    // A rejected attempt must not burn the token.
    const stored = await prisma.passwordResetToken.findFirstOrThrow({
      where: { tokenHash: hashToken(token) },
    });
    expect(stored.usedAt).toBeNull();
  });
});
