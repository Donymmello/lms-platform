import { Role } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../database/prisma";
import { resetRateLimiters } from "../../middlewares/rateLimiter";
import { authCookie, createUser } from "../../test/factories";

/** Faked at the transport boundary, like the other mail tests. */
const mailerMock = vi.hoisted(() => ({
  send: vi.fn(),
  isEnabled: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("../../integrations/mailer", () => ({ mailer: mailerMock }));

const app = createApp();
const URL = "/api/v1/users/me/instructor-request";
const MESSAGE = "Quero ensinar electrónica básica a quem está a começar.";

beforeEach(() => {
  vi.clearAllMocks();
  mailerMock.isEnabled.mockReturnValue(true);
  mailerMock.send.mockResolvedValue(undefined);
  resetRateLimiters();
});

/** Sending is fire-and-forget, so give the microtask queue a turn. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 50));
}

function recipients(): string[] {
  return mailerMock.send.mock.calls.map((call) => (call[0] as { to: string }).to);
}

describe("POST /users/me/instructor-request", () => {
  it("REFUSES an anonymous request", async () => {
    const response = await request(app).post(URL).send({ message: MESSAGE });
    expect(response.status).toBe(401);
  });

  it("rejects a message too short to tell an admin anything", async () => {
    const student = await createUser({ role: Role.STUDENT });

    const response = await request(app).post(URL).set("Cookie", authCookie(student)).send({ message: "oi" });

    expect(response.status).toBe(400);
    expect(await prisma.auditEvent.count()).toBe(0);
  });

  /**
   * The property that matters. Its predecessor on this same path promoted the
   * caller on the spot; this one must be unable to grant anything at all.
   */
  it("NEVER changes the role of the person asking", async () => {
    const student = await createUser({ role: Role.STUDENT });
    await createUser({ role: Role.ADMIN, email: "admin@example.test" });

    const response = await request(app).post(URL).set("Cookie", authCookie(student)).send({ message: MESSAGE });

    expect(response.status).toBe(202);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: student.id } });
    expect(after.role).toBe(Role.STUDENT);
  });

  it("writes the request to the audit log, with what was written in it", async () => {
    const student = await createUser({ role: Role.STUDENT });

    await request(app).post(URL).set("Cookie", authCookie(student)).send({ message: MESSAGE });

    const [event] = await prisma.auditEvent.findMany({ where: { action: "user.requested_instructor" } });
    expect(event).toMatchObject({ actorId: student.id, actorEmail: student.email, targetId: student.id });
    expect(event!.metadata).toMatchObject({ message: MESSAGE });
  });

  it("mails every active admin, one message each so none sees the others' address", async () => {
    const student = await createUser({ role: Role.STUDENT });
    await createUser({ role: Role.ADMIN, email: "ana@example.test" });
    await createUser({ role: Role.ADMIN, email: "bruno@example.test" });

    await request(app).post(URL).set("Cookie", authCookie(student)).send({ message: MESSAGE });
    await settle();

    expect(recipients().sort()).toEqual(["ana@example.test", "bruno@example.test"]);
    const mail = mailerMock.send.mock.calls[0]![0] as { subject: string; text: string };
    expect(mail.subject).toContain(student.name);
    expect(mail.text).toContain(MESSAGE);
  });

  it("leaves out a deactivated admin, who cannot act on it anyway", async () => {
    const student = await createUser({ role: Role.STUDENT });
    await createUser({ role: Role.ADMIN, email: "activo@example.test" });
    await createUser({ role: Role.ADMIN, email: "desligado@example.test", isActive: false });

    await request(app).post(URL).set("Cookie", authCookie(student)).send({ message: MESSAGE });
    await settle();

    expect(recipients()).toEqual(["activo@example.test"]);
  });

  /**
   * The message is written by a stranger and read by an admin who trusts this
   * mailbox. An anchor in it would survive a mail client that strips scripts.
   */
  it("escapes the message instead of putting a stranger's markup in an admin's inbox", async () => {
    const student = await createUser({ role: Role.STUDENT });
    await createUser({ role: Role.ADMIN, email: "admin@example.test" });

    await request(app)
      .post(URL)
      .set("Cookie", authCookie(student))
      .send({ message: 'Ensino isto <a href="https://phish.example">clica aqui</a>' });
    await settle();

    const mail = mailerMock.send.mock.calls[0]![0] as { html: string };
    expect(mail.html).not.toContain('<a href="https://phish.example"');
    expect(mail.html).toContain("&lt;a href=&quot;https://phish.example&quot;&gt;");
  });

  it("does nothing at all for someone who can already teach", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    await createUser({ role: Role.ADMIN, email: "admin@example.test" });

    const response = await request(app)
      .post(URL)
      .set("Cookie", authCookie(instructor))
      .send({ message: MESSAGE });
    await settle();

    // Answered the same way as a real request: the caller learns nothing about
    // the platform's internals from the reply.
    expect(response.status).toBe(202);
    expect(await prisma.auditEvent.count()).toBe(0);
    expect(mailerMock.send).not.toHaveBeenCalled();
  });

  it("still records the request when there is no admin to tell", async () => {
    const student = await createUser({ role: Role.STUDENT });

    const response = await request(app).post(URL).set("Cookie", authCookie(student)).send({ message: MESSAGE });
    await settle();

    expect(response.status).toBe(202);
    expect(mailerMock.send).not.toHaveBeenCalled();
    // Nobody was told, so the log is the only place the request survives.
    expect(await prisma.auditEvent.count({ where: { action: "user.requested_instructor" } })).toBe(1);
  });

  it("stops a script using this to flood the admins' inboxes", async () => {
    const student = await createUser({ role: Role.STUDENT });
    await createUser({ role: Role.ADMIN, email: "admin@example.test" });
    const ask = () => request(app).post(URL).set("Cookie", authCookie(student)).send({ message: MESSAGE });

    expect((await ask()).status).toBe(202);
    expect((await ask()).status).toBe(202);
    expect((await ask()).status).toBe(202);
    expect((await ask()).status).toBe(429);
  });

  /**
   * Counted per account, which matters here and not elsewhere: mobile networks
   * in Mozambique put many people behind one carrier-NAT address, so a per-IP
   * limit would answer a stranger's first request with "já recebemos o teu
   * pedido" because three neighbours asked first.
   */
  it("counts the limit per account, so one person cannot use up another's", async () => {
    const noisy = await createUser({ role: Role.STUDENT, email: "muito@example.test" });
    const quiet = await createUser({ role: Role.STUDENT, email: "pouco@example.test" });
    await createUser({ role: Role.ADMIN, email: "admin@example.test" });
    const askAs = (who: typeof noisy) =>
      request(app).post(URL).set("Cookie", authCookie(who)).send({ message: MESSAGE });

    await askAs(noisy);
    await askAs(noisy);
    await askAs(noisy);
    expect((await askAs(noisy)).status).toBe(429);

    // Same client, same address, different account.
    expect((await askAs(quiet)).status).toBe(202);
  });
});
