/** CARD is Visa and Mastercard, which PaySuite handles on its own page. */
export type PaymentProvider = "MPESA" | "EMOLA" | "CARD" | "PAYPAL";
export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface CheckoutResult {
  paymentId: string;
  reference: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  redirectUrl: string;
}

/** One course inside a payment, at the price charged for it. */
export interface PaymentItem {
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  amountCents: number;
}

export interface MyPayment {
  id: string;
  reference: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  /** The total charged, which is the sum of the items. */
  amountCents: number;
  currency: string;
  items: PaymentItem[];
  createdAt: string;
}
