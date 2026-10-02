import { Payment, PaymentProvider, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";

const withItems = {
  items: { include: { course: { select: { id: true, title: true, slug: true } } } },
} satisfies Prisma.PaymentInclude;

export type PaymentWithItems = Prisma.PaymentGetPayload<{ include: typeof withItems }>;

export const paymentsRepository = {
  /** One payment and its courses, written together so a half-made cart cannot exist. */
  create(data: {
    userId: string;
    provider: PaymentProvider;
    amountCents: number;
    currency: string;
    reference: string;
    providerTxnId: string;
    items: { courseId: string; amountCents: number }[];
  }): Promise<PaymentWithItems> {
    const { items, ...payment } = data;
    return prisma.payment.create({
      data: { ...payment, items: { create: items } },
      include: withItems,
    });
  },

  findByReference(reference: string): Promise<Payment | null> {
    return prisma.payment.findUnique({ where: { reference } });
  },

  /** Webhooks correlate back to us via the gateway's own transaction id, not our reference. */
  findByProviderTxnId(providerTxnId: string): Promise<Payment | null> {
    return prisma.payment.findFirst({ where: { providerTxnId } });
  },

  findWithItems(id: string): Promise<PaymentWithItems | null> {
    return prisma.payment.findUnique({ where: { id }, include: withItems });
  },

  /**
   * Whether this user has already paid for this course, in any payment —
   * including one where it shared a cart with others.
   */
  findCompletedForUserAndCourse(userId: string, courseId: string): Promise<Payment | null> {
    return prisma.payment.findFirst({
      where: { userId, status: PaymentStatus.COMPLETED, items: { some: { courseId } } },
    });
  },

  updateStatus(id: string, status: PaymentStatus, rawPayload?: unknown): Promise<Payment> {
    return prisma.payment.update({
      where: { id },
      data: { status, ...(rawPayload !== undefined ? { rawPayload: rawPayload as Prisma.InputJsonValue } : {}) },
    });
  },

  findManyForUser(userId: string): Promise<PaymentWithItems[]> {
    return prisma.payment.findMany({
      where: { userId },
      include: withItems,
      orderBy: { createdAt: "desc" },
    });
  },
};
