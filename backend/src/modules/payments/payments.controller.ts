import { IncomingHttpHeaders } from "node:http";
import { Request, Response } from "express";
import { PaymentProvider } from "@prisma/client";
import { AppError } from "../../errors";
import { asyncHandler } from "../../utils/asyncHandler";
import { paymentsService } from "./payments.service";
import { getPaymentGateway } from "./providers";
import { CreateCheckoutInput, PaypalCaptureInput } from "./schemas/payment.schema";

/**
 * Webhook signature verification is computed over the exact raw request
 * bytes, so it must use the Buffer captured by app.ts's `express.json`
 * `verify` hook rather than a re-serialization of the parsed `req.body`
 * (key order/whitespace could differ and break the HMAC/signature check).
 */
function requireRawBody(req: Request): Buffer {
  if (!req.rawBody) {
    throw new AppError("Missing raw request body — is the express.json verify hook wired up?", 500);
  }
  return req.rawBody;
}

export const paymentsController = {
  checkout: asyncHandler(async (req: Request<unknown, unknown, CreateCheckoutInput>, res: Response) => {
    const checkout = await paymentsService.checkout(req.body, req.user!);
    res.status(201).json({ status: "success", data: { checkout } });
  }),

  listMine: asyncHandler(async (req: Request, res: Response) => {
    const payments = await paymentsService.listMine(req.user!);
    res.status(200).json({ status: "success", data: { payments } });
  }),

  capturePaypal: asyncHandler(async (req: Request<unknown, unknown, PaypalCaptureInput>, res: Response) => {
    const checkout = await paymentsService.capturePaypalOrder(req.body.reference, req.user!);
    res.status(200).json({ status: "success", data: { checkout } });
  }),

  // Both mobile-money rails (M-Pesa, e-Mola) share one PaySuite account and
  // one webhook signature secret — the `method` used at checkout time
  // doesn't change how the callback is verified, so either gateway instance
  // verifies this correctly. MPESA is used here purely as the handle.
  webhookPaysuite: asyncHandler(async (req: Request, res: Response) => {
    const rawBody = requireRawBody(req);
    const outcome = await getPaymentGateway(PaymentProvider.MPESA).verifyWebhook(
      rawBody,
      req.headers as IncomingHttpHeaders
    );
    await paymentsService.handleWebhook(outcome, req.body);
    res.status(200).json({ status: "success" });
  }),

  webhookPaypal: asyncHandler(async (req: Request, res: Response) => {
    const rawBody = requireRawBody(req);
    const outcome = await getPaymentGateway(PaymentProvider.PAYPAL).verifyWebhook(
      rawBody,
      req.headers as IncomingHttpHeaders
    );
    await paymentsService.handleWebhook(outcome, req.body);
    res.status(200).json({ status: "success" });
  }),
};
