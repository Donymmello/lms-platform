import { PaymentProvider, PaymentStatus } from "@prisma/client";

export interface CheckoutResultDto {
  paymentId: string;
  reference: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  /** Empty once the payment is already COMPLETED — nothing left to redirect to. */
  redirectUrl: string;
}

export interface MyPaymentDto {
  id: string;
  reference: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amountCents: number;
  currency: string;
  courseId: string;
  courseTitle: string;
  createdAt: Date;
}
