import { PaymentProvider } from "@prisma/client";
import { z } from "zod";

export const createCheckoutSchema = z.object({
  courseId: z.string().uuid("Invalid course id"),
  provider: z.nativeEnum(PaymentProvider),
});

export const paypalCaptureSchema = z.object({
  reference: z.string().min(1, "Missing payment reference"),
});

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
export type PaypalCaptureInput = z.infer<typeof paypalCaptureSchema>;
