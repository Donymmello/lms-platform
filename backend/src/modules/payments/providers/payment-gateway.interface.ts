import { IncomingHttpHeaders } from "node:http";

export interface InitiateCheckoutParams {
  /** Our own idempotency key — generated before calling the gateway, never reused. */
  reference: string;
  amountCents: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface InitiateCheckoutResult {
  /** Where to send the browser to complete payment (hosted checkout / approval page). */
  redirectUrl: string;
  /** The gateway's own id for this transaction — used to correlate webhook callbacks. */
  providerTxnId: string;
}

export type WebhookOutcome =
  | { kind: "completed"; providerTxnId: string }
  | { kind: "failed"; providerTxnId: string }
  /** An event this gateway sends that isn't relevant to course checkout (e.g. a payout event). */
  | { kind: "ignored" };

/**
 * Common shape every payment rail (PaySuite for M-Pesa/e-Mola, PayPal, ...)
 * implements, so `payments.service.ts` never branches on provider — it just
 * asks `getPaymentGateway(provider)` for one of these.
 */
export interface PaymentGateway {
  initiateCheckout(params: InitiateCheckoutParams): Promise<InitiateCheckoutResult>;
  /**
   * Verifies the webhook call really came from the gateway (signature /
   * API-backed check) and returns a normalized outcome. Must throw
   * UnauthorizedError if verification fails — never return a "failed"
   * outcome for a bad signature, since that would let anyone fail other
   * people's payments.
   */
  verifyWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): Promise<WebhookOutcome>;
}
