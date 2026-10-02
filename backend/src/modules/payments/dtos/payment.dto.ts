import { PaymentProvider, PaymentStatus } from "@prisma/client";

export interface CheckoutResultDto {
  paymentId: string;
  reference: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  /** Empty once the payment is already COMPLETED — nothing left to redirect to. */
  redirectUrl: string;
}

/** One course inside a payment, at the price charged for it. */
export interface PaymentItemDto {
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  amountCents: number;
}

export interface MyPaymentDto {
  id: string;
  reference: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  /** The total charged, which is the sum of the items. */
  amountCents: number;
  currency: string;
  items: PaymentItemDto[];
  createdAt: Date;
}
