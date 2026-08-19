import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { paymentsRateLimiter } from "../../middlewares/rateLimiter";
import { validate } from "../../middlewares/validate";
import { paymentsController } from "./payments.controller";
import { createCheckoutSchema, paypalCaptureSchema } from "./schemas/payment.schema";

export const paymentsRouter = Router();

// Webhooks are called server-to-server by the gateways themselves — there is
// no user session, so they're mounted before `authenticate` below.
// Authenticity comes entirely from each gateway's verifyWebhook signature
// check, not from a cookie.
paymentsRouter.post("/webhooks/paysuite", paymentsController.webhookPaysuite);
paymentsRouter.post("/webhooks/paypal", paymentsController.webhookPaypal);

paymentsRouter.use(authenticate);

paymentsRouter.post(
  "/checkout",
  paymentsRateLimiter,
  validate(createCheckoutSchema, "body"),
  paymentsController.checkout
);
paymentsRouter.get("/me", paymentsController.listMine);
paymentsRouter.post(
  "/paypal/capture",
  validate(paypalCaptureSchema, "body"),
  paymentsController.capturePaypal
);
