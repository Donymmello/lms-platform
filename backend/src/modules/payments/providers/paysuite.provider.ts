import crypto from "node:crypto";
import { IncomingHttpHeaders } from "node:http";
import { env } from "../../../config/env";
import { AppError, UnauthorizedError } from "../../../errors";
import {
  InitiateCheckoutParams,
  InitiateCheckoutResult,
  PaymentGateway,
  WebhookOutcome,
} from "./payment-gateway.interface";

/**
 * The values PaySuite's `method` field accepts. `credit_card` covers both Visa
 * and Mastercard — PaySuite has no separate value per network, so neither do
 * we.
 */
type PaySuiteMethod = "mpesa" | "emola" | "credit_card";

interface PaySuiteCreatePaymentResponse {
  status: string;
  data: {
    id: string;
    amount: number;
    reference: string;
    status: string;
    checkout_url: string;
  };
}

interface PaySuiteWebhookPayload {
  event: string;
  data: {
    id: string;
    amount: number;
    reference: string;
  };
}

/**
 * PaySuite (https://paysuite.tech) is a Mozambican payment aggregator that
 * exposes M-Pesa, e-Mola and card payments behind one API — a single
 * account-level `webhook_url`/API key covers all three rails, the only
 * difference being the `method` field sent when creating a payment. That is
 * why one class serves MPESA, EMOLA and CARD (see providers/index.ts) instead
 * of three near-identical ones.
 */
export class PaySuiteGateway implements PaymentGateway {
  constructor(private readonly method: PaySuiteMethod) {}

  async initiateCheckout(params: InitiateCheckoutParams): Promise<InitiateCheckoutResult> {
    if (!env.PAYSUITE_API_KEY) {
      throw new AppError("PaySuite is not configured (missing PAYSUITE_API_KEY)", 503);
    }

    const response = await fetch(`${env.PAYSUITE_BASE_URL}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.PAYSUITE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // PaySuite takes a decimal MZN amount (e.g. 100.50), not cents.
        amount: Number((params.amountCents / 100).toFixed(2)),
        reference: params.reference,
        description: params.description,
        method: this.method,
        return_url: params.returnUrl,
        webhook_url: `${env.PUBLIC_API_URL}/api/v1/payments/webhooks/paysuite`,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new AppError(`PaySuite checkout failed (${response.status}): ${body}`, 502);
    }

    const payload = (await response.json()) as PaySuiteCreatePaymentResponse;

    return {
      redirectUrl: payload.data.checkout_url,
      providerTxnId: payload.data.id,
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async verifyWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): Promise<WebhookOutcome> {
    if (!env.PAYSUITE_WEBHOOK_SECRET) {
      throw new AppError("PaySuite webhook secret is not configured", 503);
    }

    const signature = headers["x-signature"];
    if (typeof signature !== "string" || !signature) {
      throw new UnauthorizedError("Missing PaySuite webhook signature");
    }

    const expectedHex = crypto.createHmac("sha256", env.PAYSUITE_WEBHOOK_SECRET).update(rawBody).digest("hex");

    const signatureBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedHex, "hex");
    const isValid =
      signatureBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

    if (!isValid) {
      throw new UnauthorizedError("Invalid PaySuite webhook signature");
    }

    const event = JSON.parse(rawBody.toString("utf8")) as PaySuiteWebhookPayload;

    if (event.event === "payment.success") {
      return { kind: "completed", providerTxnId: event.data.id };
    }
    if (event.event === "payment.failed") {
      return { kind: "failed", providerTxnId: event.data.id };
    }
    // payout.*/refund.* events aren't relevant to course checkout.
    return { kind: "ignored" };
  }
}
