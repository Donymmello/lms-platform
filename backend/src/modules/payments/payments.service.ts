import crypto from "node:crypto";
import { PaymentProvider, PaymentStatus } from "@prisma/client";
import { AppError, ConflictError, ForbiddenError, NotFoundError } from "../../errors";
import { AuthenticatedUser } from "../../@types/express";
import { env } from "../../config/env";
import { coursesRepository } from "../courses/courses.repository";
import { enrollmentsRepository } from "../enrollments/enrollments.repository";
import { CheckoutResultDto, MyPaymentDto } from "./dtos/payment.dto";
import { paymentsRepository } from "./payments.repository";
import { getPaymentGateway, paypalGateway } from "./providers";
import { WebhookOutcome } from "./providers/payment-gateway.interface";
import { CreateCheckoutInput } from "./schemas/payment.schema";

function newReference(): string {
  // PaySuite caps `reference` at 50 chars — "lms_" + a 32-char hex uuid is 36.
  return `lms_${crypto.randomUUID().replace(/-/g, "")}`;
}

async function requirePublishedPricedCourse(courseId: string) {
  const course = await coursesRepository.findById(courseId);
  if (!course) {
    throw new NotFoundError("Course not found");
  }
  if (course.status !== "PUBLISHED") {
    throw new ForbiddenError("This course is not available for purchase");
  }
  if (course.priceCents <= 0) {
    throw new ForbiddenError("This course is free — enroll directly instead of paying for it");
  }
  return course;
}

/** Marks a payment COMPLETED and unlocks the course, tolerating a race with any other path that already enrolled the user. */
async function completePayment(paymentId: string, rawPayload?: unknown): Promise<void> {
  const payment = await paymentsRepository.updateStatus(paymentId, PaymentStatus.COMPLETED, rawPayload);

  try {
    await enrollmentsRepository.create(payment.userId, payment.courseId, payment.id);
  } catch (error) {
    const isUniqueViolation =
      typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
    if (!isUniqueViolation) {
      throw error;
    }
  }
}

export const paymentsService = {
  async checkout(input: CreateCheckoutInput, actingUser: AuthenticatedUser): Promise<CheckoutResultDto> {
    const course = await requirePublishedPricedCourse(input.courseId);

    const alreadyEnrolled = await enrollmentsRepository.findByUserAndCourse(actingUser.id, course.id);
    if (alreadyEnrolled) {
      throw new ConflictError("You are already enrolled in this course");
    }

    const alreadyPaid = await paymentsRepository.findCompletedForUserAndCourse(actingUser.id, course.id);
    if (alreadyPaid) {
      throw new ConflictError("You have already paid for this course");
    }

    const reference = newReference();
    const gateway = getPaymentGateway(input.provider);
    const isPaypal = input.provider === PaymentProvider.PAYPAL;

    const checkout = await gateway.initiateCheckout({
      reference,
      amountCents: course.priceCents,
      description: course.title.slice(0, 125),
      returnUrl: isPaypal
        ? `${env.PUBLIC_APP_URL}/payments/paypal/return?reference=${reference}`
        : `${env.PUBLIC_APP_URL}/payments/return?reference=${reference}`,
      cancelUrl: `${env.PUBLIC_APP_URL}/payments/paypal/cancel?reference=${reference}`,
    });

    const payment = await paymentsRepository.create({
      userId: actingUser.id,
      courseId: course.id,
      provider: input.provider,
      amountCents: course.priceCents,
      currency: "MZN",
      reference,
      providerTxnId: checkout.providerTxnId,
    });

    return {
      paymentId: payment.id,
      reference: payment.reference,
      provider: payment.provider,
      status: payment.status,
      redirectUrl: checkout.redirectUrl,
    };
  },

  /** Applies a verified webhook outcome. Idempotent — a repeated delivery for a non-PENDING payment is a no-op. */
  async handleWebhook(outcome: WebhookOutcome, rawPayload?: unknown): Promise<void> {
    if (outcome.kind === "ignored") return;

    const payment = await paymentsRepository.findByProviderTxnId(outcome.providerTxnId);
    if (!payment || payment.status !== PaymentStatus.PENDING) {
      return;
    }

    if (outcome.kind === "completed") {
      await completePayment(payment.id, rawPayload);
    } else {
      await paymentsRepository.updateStatus(payment.id, PaymentStatus.FAILED, rawPayload);
    }
  },

  /** Drives the PayPal "buyer approved, now actually charge the card/balance" step, triggered from the browser return leg. */
  async capturePaypalOrder(reference: string, actingUser: AuthenticatedUser): Promise<CheckoutResultDto> {
    const payment = await paymentsRepository.findByReference(reference);
    if (!payment || payment.userId !== actingUser.id) {
      throw new NotFoundError("Payment not found");
    }
    if (payment.provider !== PaymentProvider.PAYPAL) {
      throw new AppError("This payment is not a PayPal payment", 400);
    }

    if (payment.status === PaymentStatus.PENDING) {
      if (!payment.providerTxnId) {
        throw new AppError("Payment is missing its PayPal order id", 500);
      }
      const result = await paypalGateway.captureOrder(payment.providerTxnId);
      if (result.status === "COMPLETED") {
        await completePayment(payment.id);
      }
    }

    const refreshed = await paymentsRepository.findByReference(reference);
    return {
      paymentId: payment.id,
      reference: payment.reference,
      provider: payment.provider,
      status: refreshed?.status ?? payment.status,
      redirectUrl: "",
    };
  },

  async listMine(actingUser: AuthenticatedUser): Promise<MyPaymentDto[]> {
    const payments = await paymentsRepository.findManyForUser(actingUser.id);
    return payments.map((payment) => ({
      id: payment.id,
      reference: payment.reference,
      provider: payment.provider,
      status: payment.status,
      amountCents: payment.amountCents,
      currency: payment.currency,
      courseId: payment.courseId,
      courseTitle: payment.course.title,
      createdAt: payment.createdAt,
    }));
  },
};
