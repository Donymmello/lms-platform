import crypto from "node:crypto";
import { PaymentProvider, PaymentStatus } from "@prisma/client";
import { AppError, ConflictError, ForbiddenError, NotFoundError } from "../../errors";
import { AuthenticatedUser } from "../../@types/express";
import { env } from "../../config/env";
import { mailer } from "../../integrations/mailer";
import { notifications } from "../../notifications/notifications";
import { usersRepository } from "../users/users.repository";
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

/** True for Prisma's unique-constraint violation, which here means "already enrolled". */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002"
  );
}

/**
 * Marks a payment COMPLETED and unlocks every course it covered.
 *
 * Each enrolment is attempted on its own and a duplicate is swallowed per
 * course, not for the payment as a whole: a cart where the buyer already owned
 * one of the courses must still unlock the others, and a webhook delivered
 * twice must not fail the second time.
 */
async function completePayment(paymentId: string, rawPayload?: unknown): Promise<void> {
  await paymentsRepository.updateStatus(paymentId, PaymentStatus.COMPLETED, rawPayload);

  const payment = await paymentsRepository.findWithItems(paymentId);
  if (!payment) return;

  for (const item of payment.items) {
    try {
      await enrollmentsRepository.create(payment.userId, item.courseId, payment.id);
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }
  }

  // The money has cleared and the courses are unlocked either way; the receipt
  // is a courtesy on top, so it must not be able to fail this function.
  if (mailer.isEnabled()) {
    const user = await usersRepository.findById(payment.userId);
    if (user) {
      notifications.paymentCompleted(
        user,
        payment.items.map((item) => ({ title: item.course.title, slug: item.course.slug })),
        { amountCents: payment.amountCents, currency: payment.currency }
      );
    }
  }
}

export const paymentsService = {
  /**
   * Starts one charge covering one course or a cartful.
   *
   * Every course is checked before anything is sent to the gateway: a cart
   * that is part-invalid is refused whole rather than charging for the good
   * half, because the buyer cannot see which half that was.
   */
  async checkout(input: CreateCheckoutInput, actingUser: AuthenticatedUser): Promise<CheckoutResultDto> {
    const courses = await Promise.all(input.courseIds.map(requirePublishedPricedCourse));

    for (const course of courses) {
      const alreadyEnrolled = await enrollmentsRepository.findByUserAndCourse(actingUser.id, course.id);
      if (alreadyEnrolled) {
        throw new ConflictError(`You are already enrolled in "${course.title}"`);
      }

      const alreadyPaid = await paymentsRepository.findCompletedForUserAndCourse(actingUser.id, course.id);
      if (alreadyPaid) {
        throw new ConflictError(`You have already paid for "${course.title}"`);
      }
    }

    const amountCents = courses.reduce((total, course) => total + course.priceCents, 0);
    // What the gateway shows the buyer on their phone. One title fits; a cart
    // has to be summarised, because the field is short.
    const description =
      courses.length === 1
        ? courses[0]!.title.slice(0, 125)
        : `${courses.length} cursos`.slice(0, 125);

    const reference = newReference();
    const gateway = getPaymentGateway(input.provider);
    const isPaypal = input.provider === PaymentProvider.PAYPAL;

    const checkout = await gateway.initiateCheckout({
      reference,
      amountCents,
      description,
      returnUrl: isPaypal
        ? `${env.PUBLIC_APP_URL}/payments/paypal/return?reference=${reference}`
        : `${env.PUBLIC_APP_URL}/payments/return?reference=${reference}`,
      cancelUrl: `${env.PUBLIC_APP_URL}/payments/paypal/cancel?reference=${reference}`,
    });

    const payment = await paymentsRepository.create({
      userId: actingUser.id,
      provider: input.provider,
      amountCents,
      currency: "MZN",
      reference,
      providerTxnId: checkout.providerTxnId,
      // The price is copied in, not read back from the course later: a course
      // that goes on sale next week must not rewrite what someone paid.
      items: courses.map((course) => ({ courseId: course.id, amountCents: course.priceCents })),
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
      items: payment.items.map((item) => ({
        courseId: item.courseId,
        courseTitle: item.course.title,
        courseSlug: item.course.slug,
        amountCents: item.amountCents,
      })),
      createdAt: payment.createdAt,
    }));
  },
};
