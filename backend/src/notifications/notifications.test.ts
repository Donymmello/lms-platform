import { PaymentProvider, PaymentStatus, Role } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { prisma } from "../database/prisma";
import { authCookie, createCourse, createPayment, createUser } from "../test/factories";

/**
 * The transport is faked at the integration boundary. Everything above it —
 * which events fire, who the recipient is, what the template renders, and
 * crucially what happens when sending blows up — is the real code path.
 */
const mailerMock = vi.hoisted(() => ({
  send: vi.fn(),
  isEnabled: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("../integrations/mailer", () => ({ mailer: mailerMock }));

const app = createApp();

beforeEach(() => {
  vi.clearAllMocks();
  mailerMock.isEnabled.mockReturnValue(true);
  mailerMock.send.mockResolvedValue(undefined);
});

/** The notifications are fire-and-forget, so give the microtask queue a turn. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 50));
}

function lastMail() {
  return mailerMock.send.mock.calls.at(-1)?.[0] as
    | { to: string; subject: string; html: string; text: string }
    | undefined;
}

describe("welcome email", () => {
  it("goes out when someone registers", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      name: "Ana Silva",
      email: "ana@example.test",
      password: "Str0ngPass",
    });

    expect(response.status).toBe(201);
    await settle();

    const mail = lastMail();
    expect(mail?.to).toBe("ana@example.test");
    expect(mail?.subject).toContain("Bem-vindo");
    expect(mail?.html).toContain("Ana Silva");
    // Every HTML message carries a plain-text alternative.
    expect(mail?.text.length).toBeGreaterThan(0);
  });

  it("does not go out when registration fails", async () => {
    await createUser({ email: "ocupado@example.test" });

    const response = await request(app).post("/api/v1/auth/register").send({
      name: "Outro",
      email: "ocupado@example.test",
      password: "Str0ngPass",
    });

    expect(response.status).toBe(409);
    await settle();
    expect(mailerMock.send).not.toHaveBeenCalled();
  });

  it("still registers the user when the mail server is broken", async () => {
    mailerMock.send.mockRejectedValue(new Error("SMTP connection refused"));

    const response = await request(app).post("/api/v1/auth/register").send({
      name: "Sem Email",
      email: "sememail@example.test",
      password: "Str0ngPass",
    });

    // The account is what matters; the notification is a courtesy on top.
    expect(response.status).toBe(201);
    await settle();
    expect(await prisma.user.count({ where: { email: "sememail@example.test" } })).toBe(1);
  });
});

describe("enrolment email", () => {
  it("goes out on a free enrolment, naming the course", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id, { title: "Curso Gratuito", priceCents: 0 });
    const student = await createUser({ name: "Rui", email: "rui@example.test" });

    const response = await request(app)
      .post("/api/v1/enrollments")
      .set("Cookie", authCookie(student))
      .send({ courseId: course.id });

    expect(response.status).toBe(201);
    await settle();

    const mail = lastMail();
    expect(mail?.to).toBe("rui@example.test");
    expect(mail?.subject).toContain("Curso Gratuito");
    expect(mail?.html).toContain(course.slug);
  });

  it("does not go out when the enrolment is refused", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const paid = await createCourse(instructor.id, { priceCents: 50_000 });
    const student = await createUser();

    const response = await request(app)
      .post("/api/v1/enrollments")
      .set("Cookie", authCookie(student))
      .send({ courseId: paid.id });

    expect(response.status).toBe(403);
    await settle();
    expect(mailerMock.send).not.toHaveBeenCalled();
  });

  it("skips the recipient lookup entirely when mail is switched off", async () => {
    mailerMock.isEnabled.mockReturnValue(false);
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id, { priceCents: 0 });
    const student = await createUser();

    const response = await request(app)
      .post("/api/v1/enrollments")
      .set("Cookie", authCookie(student))
      .send({ courseId: course.id });

    expect(response.status).toBe(201);
    await settle();
    expect(mailerMock.send).not.toHaveBeenCalled();
  });
});

describe("payment receipt", () => {
  it("goes out when a webhook completes a payment, with the amount", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id, { title: "Curso Pago", priceCents: 250_00 });
    const buyer = await createUser({ name: "Célia", email: "celia@example.test" });
    await createPayment(buyer.id, course.id, {
      status: PaymentStatus.PENDING,
      provider: PaymentProvider.MPESA,
      providerTxnId: "txn-mail-1",
      amountCents: 250_00,
    });

    // The gateway adapter is mocked in payments.test.ts; here the webhook is
    // driven through the real verifier, so go through the service boundary
    // that the webhook itself uses.
    const { paymentsService } = await import("../modules/payments/payments.service");
    await paymentsService.handleWebhook({ kind: "completed", providerTxnId: "txn-mail-1" });
    await settle();

    const mail = lastMail();
    expect(mail?.to).toBe("celia@example.test");
    expect(mail?.subject).toContain("Curso Pago");
    expect(mail?.html).toContain("250,00");
  });

  it("unlocks the course even when the receipt cannot be sent", async () => {
    mailerMock.send.mockRejectedValue(new Error("SMTP connection refused"));
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id, { priceCents: 10_000 });
    const buyer = await createUser();
    await createPayment(buyer.id, course.id, {
      status: PaymentStatus.PENDING,
      providerTxnId: "txn-mail-2",
    });

    const { paymentsService } = await import("../modules/payments/payments.service");
    await paymentsService.handleWebhook({ kind: "completed", providerTxnId: "txn-mail-2" });
    await settle();

    // Money taken, access granted — regardless of the mail server.
    expect(await prisma.enrollment.count({ where: { userId: buyer.id } })).toBe(1);
    expect(
      await prisma.payment.count({ where: { providerTxnId: "txn-mail-2", status: PaymentStatus.COMPLETED } })
    ).toBe(1);
  });

  it("does not go out for a failed payment", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id, { priceCents: 10_000 });
    const buyer = await createUser();
    await createPayment(buyer.id, course.id, {
      status: PaymentStatus.PENDING,
      providerTxnId: "txn-mail-3",
    });

    const { paymentsService } = await import("../modules/payments/payments.service");
    await paymentsService.handleWebhook({ kind: "failed", providerTxnId: "txn-mail-3" });
    await settle();

    expect(mailerMock.send).not.toHaveBeenCalled();
  });
});
