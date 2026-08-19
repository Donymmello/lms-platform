export type PaymentProvider = "MPESA" | "EMOLA" | "PAYPAL";
export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface CheckoutResult {
  paymentId: string;
  reference: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  redirectUrl: string;
}

export interface MyPayment {
  id: string;
  reference: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amountCents: number;
  currency: string;
  courseId: string;
  courseTitle: string;
  createdAt: string;
}
