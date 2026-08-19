import { IncomingHttpHeaders } from "node:http";
import { env } from "../../../config/env";
import { AppError, UnauthorizedError } from "../../../errors";
import {
  InitiateCheckoutParams,
  InitiateCheckoutResult,
  PaymentGateway,
  WebhookOutcome,
} from "./payment-gateway.interface";

interface PayPalTokenResponse {
  access_token: string;
  expires_in: number;
}

interface PayPalOrderResponse {
  id: string;
  status: string;
  links: Array<{ href: string; rel: string; method: string }>;
}

interface PayPalWebhookEvent {
  event_type: string;
  resource: {
    id: string;
    supplementary_data?: { related_ids?: { order_id?: string } };
  };
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    throw new AppError("PayPal is not configured (missing client id/secret)", 503);
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  const basicAuth = Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`${env.PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new AppError(`PayPal auth failed (${response.status})`, 502);
  }

  const payload = (await response.json()) as PayPalTokenResponse;
  cachedToken = { value: payload.access_token, expiresAt: Date.now() + payload.expires_in * 1000 };
  return payload.access_token;
}

/**
 * PayPal does not support MZN as a transaction currency (its supported-
 * currency list tops out at ~24 currencies and MZN isn't one of them), so
 * priced courses — stored in MZN cents everywhere else in the app — are
 * converted to `PAYPAL_CURRENCY` (USD by default) for this leg only, using
 * a static env-configured rate. Replace with a real FX source before
 * relying on this for real transactions; a stale rate either overcharges
 * or undercharges buyers.
 */
function convertMznCentsToPaypalUnits(amountCents: number): string {
  const mzn = amountCents / 100;
  const converted = mzn / env.PAYPAL_MZN_PER_USD_RATE;
  return converted.toFixed(2);
}

export class PayPalGateway implements PaymentGateway {
  async initiateCheckout(params: InitiateCheckoutParams): Promise<InitiateCheckoutResult> {
    const accessToken = await getAccessToken();

    const response = await fetch(`${env.PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: params.reference,
            description: params.description,
            amount: {
              currency_code: env.PAYPAL_CURRENCY,
              value: convertMznCentsToPaypalUnits(params.amountCents),
            },
          },
        ],
        application_context: {
          return_url: params.returnUrl,
          cancel_url: params.cancelUrl,
          user_action: "PAY_NOW",
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new AppError(`PayPal order creation failed (${response.status}): ${body}`, 502);
    }

    const payload = (await response.json()) as PayPalOrderResponse;
    const approveLink = payload.links.find((link) => link.rel === "approve")?.href;
    if (!approveLink) {
      throw new AppError("PayPal did not return an approval link", 502);
    }

    return { redirectUrl: approveLink, providerTxnId: payload.id };
  }

  /**
   * Called from the browser-return leg (GET/POST .../payments/paypal/capture)
   * right after the buyer approves on PayPal's hosted page. This is the
   * primary success signal; the async webhook below is a backstop in case
   * the buyer's browser never makes it back to us.
   */
  async captureOrder(orderId: string): Promise<{ status: "COMPLETED" | "PENDING" }> {
    const accessToken = await getAccessToken();
    const response = await fetch(`${env.PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const payload = (await response.json().catch(() => ({}))) as { status?: string; name?: string };

    if (!response.ok) {
      // The webhook may have already captured this order — treat as success rather than erroring.
      if (payload.name === "UNPROCESSABLE_ENTITY") {
        return { status: "COMPLETED" };
      }
      throw new AppError(`PayPal capture failed (${response.status})`, 502);
    }

    return { status: payload.status === "COMPLETED" ? "COMPLETED" : "PENDING" };
  }

  async verifyWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): Promise<WebhookOutcome> {
    if (!env.PAYPAL_WEBHOOK_ID) {
      throw new AppError("PayPal webhook id is not configured", 503);
    }

    const webhookEvent = JSON.parse(rawBody.toString("utf8")) as PayPalWebhookEvent;
    const accessToken = await getAccessToken();

    const verifyResponse = await fetch(`${env.PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transmission_id: headers["paypal-transmission-id"],
        transmission_time: headers["paypal-transmission-time"],
        cert_url: headers["paypal-cert-url"],
        auth_algo: headers["paypal-auth-algo"],
        transmission_sig: headers["paypal-transmission-sig"],
        webhook_id: env.PAYPAL_WEBHOOK_ID,
        webhook_event: webhookEvent,
      }),
    });

    if (!verifyResponse.ok) {
      throw new AppError(`PayPal webhook verification request failed (${verifyResponse.status})`, 502);
    }

    const verification = (await verifyResponse.json()) as { verification_status: string };
    if (verification.verification_status !== "SUCCESS") {
      throw new UnauthorizedError("Invalid PayPal webhook signature");
    }

    const orderId = webhookEvent.resource.supplementary_data?.related_ids?.order_id ?? webhookEvent.resource.id;

    if (webhookEvent.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      return { kind: "completed", providerTxnId: orderId };
    }
    if (webhookEvent.event_type === "PAYMENT.CAPTURE.DENIED" || webhookEvent.event_type === "CHECKOUT.ORDER.VOIDED") {
      return { kind: "failed", providerTxnId: orderId };
    }
    // CHECKOUT.ORDER.APPROVED etc. — approval isn't completion, the capture
    // call is what actually moves money, so there's nothing to act on yet.
    return { kind: "ignored" };
  }
}
