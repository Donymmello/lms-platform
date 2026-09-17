import { CourseStatus, PaymentProvider, PaymentStatus, Role } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../database/prisma";
import { UnauthorizedError } from "../../errors";
import { authCookie, createCourse, createPayment, createUser, enroll } from "../../test/factories";

/**
 * The real gateways call PaySuite and PayPal over the network. Only the
 * adapter boundary is faked here — everything below it (payment rows,
 * enrollment unlocking, idempotency, signature rejection) is the real code
 * path, which is where the bugs that matter would live.
 */
const gateway = vi.hoisted(() => ({
  initiateCheckout: vi.fn(),
  verifyWebhook: vi.fn(),
  captureOrder: vi.fn(),
}));

vi.mock("./providers", () => ({
  getPaymentGateway: () => gateway,
  paypalGateway: gateway,
}));

const app = createApp();

beforeEach(() => {
  vi.clearAllMocks();
  gateway.initiateCheckout.mockResolvedValue({
    redirectUrl: "https://gateway.test/checkout/abc",
    providerTxnId: "txn-abc",
  });
});

async function pricedCourse(priceCents = 50_000) {
  const instructor = await createUser({ role: Role.INSTRUCTOR });
  return createCourse(instructor.id, { priceCents, status: CourseStatus.PUBLISHED });
}

describe("POST /payments/checkout", () => {
  it("creates a PENDING payment and hands back the gateway's redirect URL", async () => {
    const course = await pricedCourse(50_000);
    const buyer = await createUser();

    const response = await request(app)
      .post("/api/v1/payments/checkout")
      .set("Cookie", authCookie(buyer))
      .send({ courseId: course.id, provider: PaymentProvider.MPESA });

    expect(response.status).toBe(201);
    expect(response.body.data.checkout.redirectUrl).toBe("https://gateway.test/checkout/abc");

    const payment = await prisma.payment.findFirstOrThrow({ where: { userId: buyer.id } });
    expect(payment).toMatchObject({
      status: PaymentStatus.PENDING,
      amountCents: 50_000,
      currency: "MZN",
      providerTxnId: "txn-abc",
      provider: PaymentProvider.MPESA,
    });
    // No access is granted until the gateway confirms.
    expect(await prisma.enrollment.count()).toBe(0);
  });

  it("charges the course's price, not anything the client sends", async () => {
    const course = await pricedCourse(75_000);
    const buyer = await createUser();

    await request(app)
      .post("/api/v1/payments/checkout")
      .set("Cookie", authCookie(buyer))
      .send({ courseId: course.id, provider: PaymentProvider.MPESA, amountCents: 1 });

    expect(gateway.initiateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 75_000 })
    );
  });

  it("generates a fresh reference per checkout", async () => {
    const first = await pricedCourse();
    const second = await pricedCourse();
    const buyer = await createUser();

    for (const course of [first, second]) {
      await request(app)
        .post("/api/v1/payments/checkout")
        .set("Cookie", authCookie(buyer))
        .send({ courseId: course.id, provider: PaymentProvider.EMOLA });
    }

    const references = (await prisma.payment.findMany()).map((payment) => payment.reference);
    expect(new Set(references).size).toBe(2);
    expect(references.every((reference) => reference.startsWith("lms_"))).toBe(true);
  });

  it("refuses a free course", async () => {
    const course = await pricedCourse(0);
    const buyer = await createUser();

    const response = await request(app)
      .post("/api/v1/payments/checkout")
      .set("Cookie", authCookie(buyer))
      .send({ courseId: course.id, provider: PaymentProvider.MPESA });

    expect(response.status).toBe(403);
  });

  it("refuses a draft course", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id, {
      priceCents: 50_000,
      status: CourseStatus.DRAFT,
    });
    const buyer = await createUser();

    const response = await request(app)
      .post("/api/v1/payments/checkout")
      .set("Cookie", authCookie(buyer))
      .send({ courseId: course.id, provider: PaymentProvider.MPESA });

    expect(response.status).toBe(403);
  });

  it("refuses a buyer who is already enrolled", async () => {
    const course = await pricedCourse();
    const buyer = await createUser();
    await enroll(buyer.id, course.id);

    const response = await request(app)
      .post("/api/v1/payments/checkout")
      .set("Cookie", authCookie(buyer))
      .send({ courseId: course.id, provider: PaymentProvider.MPESA });

    expect(response.status).toBe(409);
    expect(gateway.initiateCheckout).not.toHaveBeenCalled();
  });

  it("refuses a buyer who already has a COMPLETED payment for the course", async () => {
    const course = await pricedCourse();
    const buyer = await createUser();
    await createPayment(buyer.id, course.id, { status: PaymentStatus.COMPLETED });

    const response = await request(app)
      .post("/api/v1/payments/checkout")
      .set("Cookie", authCookie(buyer))
      .send({ courseId: course.id, provider: PaymentProvider.MPESA });

    expect(response.status).toBe(409);
  });

  it("requires a session and a known provider", async () => {
    const course = await pricedCourse();
    const buyer = await createUser();

    const anonymous = await request(app)
      .post("/api/v1/payments/checkout")
      .send({ courseId: course.id, provider: PaymentProvider.MPESA });
    const badProvider = await request(app)
      .post("/api/v1/payments/checkout")
      .set("Cookie", authCookie(buyer))
      .send({ courseId: course.id, provider: "BITCOIN" });

    expect(anonymous.status).toBe(401);
    expect(badProvider.status).toBe(400);
  });
});

describe("POST /payments/webhooks/paysuite", () => {
  it("completes the payment and unlocks the course, with no session at all", async () => {
    const course = await pricedCourse();
    const buyer = await createUser();
    const payment = await createPayment(buyer.id, course.id, {
      status: PaymentStatus.PENDING,
      providerTxnId: "txn-1",
    });
    gateway.verifyWebhook.mockResolvedValue({ kind: "completed", providerTxnId: "txn-1" });

    const response = await request(app)
      .post("/api/v1/payments/webhooks/paysuite")
      .send({ event: "payment.success" });

    expect(response.status).toBe(200);
    const updated = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updated.status).toBe(PaymentStatus.COMPLETED);

    const enrollment = await prisma.enrollment.findFirstOrThrow({ where: { userId: buyer.id } });
    expect(enrollment.paymentId).toBe(payment.id);
  });

  it("is idempotent — a repeated delivery does not enroll twice", async () => {
    const course = await pricedCourse();
    const buyer = await createUser();
    await createPayment(buyer.id, course.id, {
      status: PaymentStatus.PENDING,
      providerTxnId: "txn-2",
    });
    gateway.verifyWebhook.mockResolvedValue({ kind: "completed", providerTxnId: "txn-2" });

    await request(app).post("/api/v1/payments/webhooks/paysuite").send({ event: "payment.success" });
    await request(app).post("/api/v1/payments/webhooks/paysuite").send({ event: "payment.success" });
    await request(app).post("/api/v1/payments/webhooks/paysuite").send({ event: "payment.success" });

    expect(await prisma.enrollment.count()).toBe(1);
    expect(await prisma.payment.count({ where: { status: PaymentStatus.COMPLETED } })).toBe(1);
  });

  it("marks a failed outcome FAILED and grants no access", async () => {
    const course = await pricedCourse();
    const buyer = await createUser();
    const payment = await createPayment(buyer.id, course.id, {
      status: PaymentStatus.PENDING,
      providerTxnId: "txn-3",
    });
    gateway.verifyWebhook.mockResolvedValue({ kind: "failed", providerTxnId: "txn-3" });

    await request(app).post("/api/v1/payments/webhooks/paysuite").send({ event: "payment.failed" });

    const updated = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updated.status).toBe(PaymentStatus.FAILED);
    expect(await prisma.enrollment.count()).toBe(0);
  });

  it("rejects a bad signature with 401 and leaves the payment untouched", async () => {
    const course = await pricedCourse();
    const buyer = await createUser();
    const payment = await createPayment(buyer.id, course.id, {
      status: PaymentStatus.PENDING,
      providerTxnId: "txn-4",
    });
    gateway.verifyWebhook.mockRejectedValue(new UnauthorizedError("Invalid webhook signature"));

    const response = await request(app)
      .post("/api/v1/payments/webhooks/paysuite")
      .send({ event: "payment.success", forged: true });

    expect(response.status).toBe(401);
    const untouched = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(untouched.status).toBe(PaymentStatus.PENDING);
    expect(await prisma.enrollment.count()).toBe(0);
  });

  it("ignores an event for an unknown transaction without failing the delivery", async () => {
    gateway.verifyWebhook.mockResolvedValue({ kind: "completed", providerTxnId: "txn-unknown" });

    const response = await request(app)
      .post("/api/v1/payments/webhooks/paysuite")
      .send({ event: "payment.success" });

    expect(response.status).toBe(200);
    expect(await prisma.enrollment.count()).toBe(0);
  });

  it("ignores an unrelated gateway event", async () => {
    const course = await pricedCourse();
    const buyer = await createUser();
    const payment = await createPayment(buyer.id, course.id, {
      status: PaymentStatus.PENDING,
      providerTxnId: "txn-5",
    });
    gateway.verifyWebhook.mockResolvedValue({ kind: "ignored" });

    await request(app).post("/api/v1/payments/webhooks/paysuite").send({ event: "payout.created" });

    const untouched = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(untouched.status).toBe(PaymentStatus.PENDING);
  });

  it("does not resurrect an already FAILED payment", async () => {
    const course = await pricedCourse();
    const buyer = await createUser();
    const payment = await createPayment(buyer.id, course.id, {
      status: PaymentStatus.FAILED,
      providerTxnId: "txn-6",
    });
    gateway.verifyWebhook.mockResolvedValue({ kind: "completed", providerTxnId: "txn-6" });

    await request(app).post("/api/v1/payments/webhooks/paysuite").send({ event: "payment.success" });

    const untouched = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(untouched.status).toBe(PaymentStatus.FAILED);
    expect(await prisma.enrollment.count()).toBe(0);
  });
});

describe("POST /payments/paypal/capture", () => {
  it("captures an approved order and unlocks the course", async () => {
    const course = await pricedCourse();
    const buyer = await createUser();
    const payment = await createPayment(buyer.id, course.id, {
      status: PaymentStatus.PENDING,
      provider: PaymentProvider.PAYPAL,
      providerTxnId: "paypal-order-1",
    });
    gateway.captureOrder.mockResolvedValue({ status: "COMPLETED" });

    const response = await request(app)
      .post("/api/v1/payments/paypal/capture")
      .set("Cookie", authCookie(buyer))
      .send({ reference: payment.reference });

    expect(response.status).toBe(200);
    expect(gateway.captureOrder).toHaveBeenCalledWith("paypal-order-1");
    expect(response.body.data.checkout.status).toBe(PaymentStatus.COMPLETED);
    expect(await prisma.enrollment.count()).toBe(1);
  });

  it("refuses to capture someone else's payment", async () => {
    const course = await pricedCourse();
    const buyer = await createUser();
    const attacker = await createUser();
    const payment = await createPayment(buyer.id, course.id, {
      status: PaymentStatus.PENDING,
      provider: PaymentProvider.PAYPAL,
      providerTxnId: "paypal-order-2",
    });

    const response = await request(app)
      .post("/api/v1/payments/paypal/capture")
      .set("Cookie", authCookie(attacker))
      .send({ reference: payment.reference });

    expect(response.status).toBe(404);
    expect(gateway.captureOrder).not.toHaveBeenCalled();
  });

  it("rejects a reference that belongs to a non-PayPal payment", async () => {
    const course = await pricedCourse();
    const buyer = await createUser();
    const payment = await createPayment(buyer.id, course.id, {
      status: PaymentStatus.PENDING,
      provider: PaymentProvider.MPESA,
      providerTxnId: "txn-7",
    });

    const response = await request(app)
      .post("/api/v1/payments/paypal/capture")
      .set("Cookie", authCookie(buyer))
      .send({ reference: payment.reference });

    expect(response.status).toBe(400);
  });

  it("does not re-capture a payment that is already COMPLETED", async () => {
    const course = await pricedCourse();
    const buyer = await createUser();
    const payment = await createPayment(buyer.id, course.id, {
      status: PaymentStatus.COMPLETED,
      provider: PaymentProvider.PAYPAL,
      providerTxnId: "paypal-order-3",
    });

    const response = await request(app)
      .post("/api/v1/payments/paypal/capture")
      .set("Cookie", authCookie(buyer))
      .send({ reference: payment.reference });

    expect(response.status).toBe(200);
    expect(gateway.captureOrder).not.toHaveBeenCalled();
  });
});

describe("GET /payments/me", () => {
  it("returns only the acting user's payments", async () => {
    const course = await pricedCourse();
    const buyer = await createUser();
    const other = await createUser();
    await createPayment(buyer.id, course.id, { amountCents: 50_000 });
    await createPayment(other.id, course.id, { amountCents: 90_000 });

    const response = await request(app).get("/api/v1/payments/me").set("Cookie", authCookie(buyer));

    expect(response.status).toBe(200);
    expect(response.body.data.payments).toHaveLength(1);
    expect(response.body.data.payments[0]).toMatchObject({
      amountCents: 50_000,
      courseTitle: course.title,
    });
  });

  it("requires a session", async () => {
    const response = await request(app).get("/api/v1/payments/me");
    expect(response.status).toBe(401);
  });
});
