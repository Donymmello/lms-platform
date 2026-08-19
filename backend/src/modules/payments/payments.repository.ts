import { Payment, PaymentProvider, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";

export type PaymentWithCourse = Prisma.PaymentGetPayload<{
  include: { course: { select: { title: true } } };
}>;

export const paymentsRepository = {
  create(data: {
    userId: string;
    courseId: string;
    provider: PaymentProvider;
    amountCents: number;
    currency: string;
    reference: string;
    providerTxnId: string;
  }): Promise<Payment> {
    return prisma.payment.create({ data });
  },

  findByReference(reference: string): Promise<Payment | null> {
    return prisma.payment.findUnique({ where: { reference } });
  },

  /** Webhooks correlate back to us via the gateway's own transaction id, not our reference. */
  findByProviderTxnId(providerTxnId: string): Promise<Payment | null> {
    return prisma.payment.findFirst({ where: { providerTxnId } });
  },

  findCompletedForUserAndCourse(userId: string, courseId: string): Promise<Payment | null> {
    return prisma.payment.findFirst({
      where: { userId, courseId, status: PaymentStatus.COMPLETED },
    });
  },

  updateStatus(id: string, status: PaymentStatus, rawPayload?: unknown): Promise<Payment> {
    return prisma.payment.update({
      where: { id },
      data: { status, ...(rawPayload !== undefined ? { rawPayload: rawPayload as Prisma.InputJsonValue } : {}) },
    });
  },

  findManyForUser(userId: string): Promise<PaymentWithCourse[]> {
    return prisma.payment.findMany({
      where: { userId },
      include: { course: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
    });
  },
};
