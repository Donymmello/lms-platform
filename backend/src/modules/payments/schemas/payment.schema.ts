import { PaymentProvider } from "@prisma/client";
import { z } from "zod";

export const createCheckoutSchema = z.object({
  /**
   * One or more courses, paid in a single charge. A cart is the reason: every
   * M-Pesa charge is a USSD confirmation on the buyer's phone, so three
   * courses have to be one charge rather than three.
   *
   * Twenty is an arbitrary ceiling, there to stop a request asking the gateway
   * for a number nobody meant to buy.
   */
  courseIds: z
    .array(z.string().uuid("Invalid course id"))
    .min(1, "Pick at least one course")
    .max(20, "Too many courses in one payment")
    // The same course twice would charge for it twice and then enrol once.
    .refine((ids) => new Set(ids).size === ids.length, "The same course appears twice"),
  provider: z.nativeEnum(PaymentProvider),
});

export const paypalCaptureSchema = z.object({
  reference: z.string().min(1, "Missing payment reference"),
});

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
export type PaypalCaptureInput = z.infer<typeof paypalCaptureSchema>;
