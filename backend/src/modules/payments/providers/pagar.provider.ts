import crypto from "node:crypto";
import { IncomingHttpHeaders } from "node:http";
import { env } from "../../../config/env";
import { AppError, UnauthorizedError } from "../../../errors";
import {
  InitiateCheckoutParams,
  InitiateCheckoutResult,
  PagarPaymentStatus,
  PaymentGateway,
  WebhookOutcome,
} from "./payment-gateway.interface";

type PagarMethod = "MPESA" | "EMOLA";

interface PagarCreatePaymentResponse {
  payment: { id: string };
}

interface PagarApiErrorResponse {
  error?: unknown;
  message?: unknown;
  requestId?: unknown;
}

interface PagarPaymentResponse {
  payment?: PagarPaymentRecord;
  data?: { payment?: PagarPaymentRecord } & PagarPaymentRecord;
  receipt?: PagarReceipt;
  id?: string;
  reference?: string;
  amountMzn?: number;
  status?: string;
}

interface PagarPaymentRecord {
  id?: string;
  reference?: string;
  amountMzn?: number;
  status?: string;
  receipt?: PagarReceipt;
}

interface PagarReceipt {
  number?: unknown;
  url?: unknown;
}

interface PagarWebhookEvent {
  type?: string;
  event?: string;
  data: { id?: string; reference?: string; amountMzn?: number; receipt?: PagarReceipt };
}

function receiptDetails(receipt?: PagarReceipt): Pick<PagarPaymentStatus, "receiptNumber" | "receiptUrl"> {
  if (!receipt) return {};

  const details: Pick<PagarPaymentStatus, "receiptNumber" | "receiptUrl"> = {};
  if (typeof receipt.number === "string" && receipt.number.trim()) {
    details.receiptNumber = receipt.number.trim();
  }
  if (typeof receipt.url === "string") {
    try {
      if (new URL(receipt.url).protocol === "https:") details.receiptUrl = receipt.url;
    } catch {
      // An invalid optional receipt URL must not prevent a verified payment from completing.
    }
  }
  return details;
}

export class PagarGateway implements PaymentGateway {
  constructor(private readonly method: PagarMethod) {}

  async getPaymentByReference(reference: string): Promise<PagarPaymentStatus> {
    if (!env.PAGAR_API_KEY) {
      throw new AppError("Pagar is not configured (missing API key)", 503);
    }

    const response = await fetch(
      `${env.PAGAR_API_BASE_URL}/payments/by-reference/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${env.PAGAR_API_KEY}` } }
    );
    if (!response.ok) {
      throw new AppError(`Pagar payment status lookup failed (HTTP ${response.status})`, 502);
    }

    let payload: PagarPaymentResponse;
    try {
      payload = (await response.json()) as PagarPaymentResponse;
    } catch {
      throw new AppError("Pagar returned an invalid payment status response", 502);
    }

    const payment = payload.payment ?? payload.data?.payment ?? payload.data ?? payload;
    const statuses: PagarPaymentStatus["status"][] = [
      "PENDING",
      "PROCESSING",
      "PAID",
      "FAILED",
      "CANCELLED",
      "RECONCILIATION_REQUIRED",
      "REFUNDED",
    ];
    if (
      typeof payment.id !== "string" ||
      typeof payment.reference !== "string" ||
      typeof payment.amountMzn !== "number" ||
      !Number.isInteger(payment.amountMzn) ||
      !statuses.includes(payment.status as PagarPaymentStatus["status"])
    ) {
      throw new AppError("Pagar returned incomplete payment status data", 502);
    }

    return {
      id: payment.id,
      reference: payment.reference,
      amountMzn: payment.amountMzn,
      status: payment.status as PagarPaymentStatus["status"],
      ...receiptDetails(payment.receipt ?? payload.receipt),
    };
  }

  async initiateCheckout(params: InitiateCheckoutParams): Promise<InitiateCheckoutResult> {
    if (!env.PAGAR_API_KEY || !env.PAGAR_SIGNING_SECRET) {
      throw new AppError("Pagar is not configured (missing API key or signing secret)", 503);
    }
    if (!params.payerPhone) {
      throw new AppError("A payer phone number is required for Pagar", 400);
    }

    const amountMzn = params.amountCents / 100;
    if (!Number.isInteger(amountMzn) || amountMzn < 20 || amountMzn > 40_000) {
      throw new AppError("Pagar payments must be between 20 and 40,000 MZN in whole meticais", 400);
    }

    const body = {
      reference: params.reference,
      title:
        params.description.length >= 5
          ? params.description.slice(0, 120)
          : "Compra Protagonista Academy",
      description: params.description,
      amountMzn,
      method: this.method,
      payerPhone: params.payerPhone,
    };
    const rawBody = JSON.stringify(body);
    const url = `${env.PAGAR_API_BASE_URL}/payments`;
    const timestamp = Date.now().toString();
    const nonce = crypto.randomBytes(18).toString("base64url");
    const bodyHash = crypto.createHash("sha256").update(rawBody).digest("hex");
    const pathname = new URL(url).pathname;
    const canonical = [timestamp, nonce, "POST", pathname, bodyHash].join("\n");
    const signature = crypto.createHmac("sha256", env.PAGAR_SIGNING_SECRET).update(canonical).digest("hex");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.PAGAR_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": params.reference,
        "X-Pagar-Timestamp": timestamp,
        "X-Pagar-Nonce": nonce,
        "X-Pagar-Signature": `v1=${signature}`,
      },
      body: rawBody,
    });

    if (!response.ok) {
      const responseText = await response.text();
      let errorPayload: PagarApiErrorResponse = {};
      if (responseText) {
        try {
          errorPayload = JSON.parse(responseText) as PagarApiErrorResponse;
        } catch {
          errorPayload = {};
        }
      }

      const message =
        typeof errorPayload.message === "string"
          ? errorPayload.message
          : `Pagar rejected the payment request (HTTP ${response.status})`;
      const details = {
        ...(typeof errorPayload.error === "string" ? { code: errorPayload.error } : {}),
        ...(typeof errorPayload.requestId === "string" ? { requestId: errorPayload.requestId } : {}),
      };

      throw new AppError(
        `Pagar payment creation failed: ${message}`,
        response.status >= 400 && response.status < 500 ? response.status : 502,
        Object.keys(details).length ? details : undefined
      );
    }

    let payload: PagarCreatePaymentResponse;
    try {
      payload = (await response.json()) as PagarCreatePaymentResponse;
    } catch {
      throw new AppError("Pagar returned an invalid payment response", 502);
    }
    if (!payload.payment?.id) {
      throw new AppError("Pagar did not return a payment id", 502);
    }

    // Pagar sends an M-Pesa/e-Mola prompt to the phone; it has no hosted checkout URL.
    return { redirectUrl: params.returnUrl, providerTxnId: payload.payment.id };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async verifyWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): Promise<WebhookOutcome> {
    if (!env.PAGAR_WEBHOOK_SECRET) {
      throw new AppError("Pagar webhook secret is not configured", 503);
    }

    const signature = headers["pagar-signature"];
    if (typeof signature !== "string") {
      throw new UnauthorizedError("Missing Pagar webhook signature");
    }

    const timestamp = signature.match(/(?:^|,)t=(\d+)(?:,|$)/)?.[1];
    const receivedHex = signature.match(/(?:^|,)v1=([a-f0-9]{64})(?:,|$)/)?.[1];
    if (
      !timestamp ||
      !receivedHex ||
      Math.abs(Date.now() / 1000 - Number(timestamp)) > 300
    ) {
      throw new UnauthorizedError("Invalid or expired Pagar webhook signature");
    }

    const expectedHex = crypto
      .createHmac("sha256", env.PAGAR_WEBHOOK_SECRET)
      .update(`${timestamp}.${rawBody.toString("utf8")}`)
      .digest("hex");
    const received = Buffer.from(receivedHex, "hex");
    const expected = Buffer.from(expectedHex, "hex");
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
      throw new UnauthorizedError("Invalid Pagar webhook signature");
    }

    const event = JSON.parse(rawBody.toString("utf8")) as PagarWebhookEvent;
    const eventId = headers["pagar-event-id"];
    if (typeof eventId !== "string" || !eventId) {
      throw new UnauthorizedError("Missing Pagar webhook event id");
    }

    const eventType = event.type ?? event.event ?? headers["pagar-event-type"];
    if (eventType !== "payment.succeeded" && eventType !== "payment.failed") {
      return { kind: "ignored" };
    }
    if (
      !event.data ||
      typeof event.data.id !== "string" ||
      typeof event.data.reference !== "string" ||
      typeof event.data.amountMzn !== "number" ||
      !Number.isInteger(event.data.amountMzn)
    ) {
      throw new AppError("Invalid Pagar payment webhook payload", 400);
    }

    if (eventType === "payment.succeeded") {
      return {
        kind: "completed",
        providerTxnId: event.data.id,
        reference: event.data.reference,
        amountCents: event.data.amountMzn! * 100,
        eventId,
        ...receiptDetails(event.data.receipt),
      };
    }
    return {
      kind: "failed",
      providerTxnId: event.data.id,
      reference: event.data.reference,
      amountCents: event.data.amountMzn! * 100,
      eventId,
    };
  }
}
