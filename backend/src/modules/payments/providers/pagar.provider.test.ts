import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../../../config/env";
import { PagarGateway } from "./pagar.provider";

const originalConfig = {
  apiKey: env.PAGAR_API_KEY,
  signingSecret: env.PAGAR_SIGNING_SECRET,
  webhookSecret: env.PAGAR_WEBHOOK_SECRET,
};

beforeEach(() => {
  env.PAGAR_API_KEY = "test-api-key";
  env.PAGAR_SIGNING_SECRET = "test-signing-secret";
  env.PAGAR_WEBHOOK_SECRET = "test-webhook-secret";
});

afterEach(() => {
  env.PAGAR_API_KEY = originalConfig.apiKey;
  env.PAGAR_SIGNING_SECRET = originalConfig.signingSecret;
  env.PAGAR_WEBHOOK_SECRET = originalConfig.webhookSecret;
  vi.unstubAllGlobals();
});

describe("PagarGateway", () => {
  it("signs the POST body and uses the reference as its idempotency key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ payment: { id: "pay_123" } }), { status: 202 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new PagarGateway("MPESA").initiateCheckout({
      reference: "lms_0123456789abcdef0123456789abcdef",
      amountCents: 50_000,
      description: "Curso de Excel",
      payerPhone: "840000001",
      returnUrl: "https://lms.test/payments/return?reference=lms_0123456789abcdef0123456789abcdef",
      cancelUrl: "",
    });

    const [url, request] = fetchMock.mock.calls[0]!;
    const body = request!.body as string;
    const headers = new Headers(request!.headers);
    const timestamp = headers.get("X-Pagar-Timestamp")!;
    const nonce = headers.get("X-Pagar-Nonce")!;
    const bodyHash = crypto.createHash("sha256").update(body).digest("hex");
    const canonical = [timestamp, nonce, "POST", new URL(url as string).pathname, bodyHash].join("\n");
    const expectedSignature = crypto.createHmac("sha256", env.PAGAR_SIGNING_SECRET).update(canonical).digest("hex");

    expect(headers.get("Idempotency-Key")).toBe("lms_0123456789abcdef0123456789abcdef");
    expect(headers.get("X-Pagar-Signature")).toBe(`v1=${expectedSignature}`);
    expect(JSON.parse(body)).toMatchObject({ amountMzn: 500, method: "MPESA", payerPhone: "840000001" });
    expect(result).toEqual({
      redirectUrl: "https://lms.test/payments/return?reference=lms_0123456789abcdef0123456789abcdef",
      providerTxnId: "pay_123",
    });
  });

  it("accepts a valid signed payment webhook", async () => {
    const rawBody = Buffer.from(
      JSON.stringify({
        type: "payment.succeeded",
        data: {
          id: "pay_123",
          reference: "lms_test",
          amountMzn: 500,
          receipt: { number: "REC-123", url: "https://pagar.co.mz/receipts/REC-123" },
        },
      })
    );
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto
      .createHmac("sha256", env.PAGAR_WEBHOOK_SECRET)
      .update(`${timestamp}.${rawBody.toString("utf8")}`)
      .digest("hex");

    await expect(
      new PagarGateway("MPESA").verifyWebhook(rawBody, {
        "pagar-signature": `t=${timestamp},v1=${signature}`,
        "pagar-event-id": "evt_123",
      })
    ).resolves.toEqual({
      kind: "completed",
      providerTxnId: "pay_123",
      reference: "lms_test",
      amountCents: 50_000,
      eventId: "evt_123",
      receiptNumber: "REC-123",
      receiptUrl: "https://pagar.co.mz/receipts/REC-123",
    });
  });

  it("returns Pagar's safe rejection message and request id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "INVALID_PAYER_PHONE",
            message: "Use a valid M-Pesa phone number.",
            requestId: "req_test_123",
          }),
          { status: 400 }
        )
      )
    );

    await expect(
      new PagarGateway("MPESA").initiateCheckout({
        reference: "lms_0123456789abcdef0123456789abcdef",
        amountCents: 50_000,
        description: "Curso de Excel",
        payerPhone: "840000001",
        returnUrl: "https://lms.test/payments/return",
        cancelUrl: "",
      })
    ).rejects.toMatchObject({
      message: "Pagar payment creation failed: Use a valid M-Pesa phone number.",
      statusCode: 400,
      details: { code: "INVALID_PAYER_PHONE", requestId: "req_test_123" },
    });
  });

  it("reads the authoritative payment state by reference", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            payment: {
              id: "pay_123",
              reference: "lms_test",
              amountMzn: 500,
              status: "PAID",
              receipt: { number: "REC-123", url: "https://pagar.co.mz/receipts/REC-123" },
            },
          }),
          { status: 200 }
        )
      )
    );

    await expect(new PagarGateway("EMOLA").getPaymentByReference("lms_test")).resolves.toEqual({
      id: "pay_123",
      reference: "lms_test",
      amountMzn: 500,
      status: "PAID",
      receiptNumber: "REC-123",
      receiptUrl: "https://pagar.co.mz/receipts/REC-123",
    });
  });

  it("rejects fractional MZN amounts without calling Pagar", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      new PagarGateway("MPESA").initiateCheckout({
        reference: "lms_0123456789abcdef0123456789abcdef",
        amountCents: 199_999,
        description: "Curso de Excel",
        payerPhone: "840000001",
        returnUrl: "https://lms.test/payments/return",
        cancelUrl: "",
      })
    ).rejects.toThrow("whole meticais");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid webhook signature", async () => {
    await expect(
      new PagarGateway("MPESA").verifyWebhook(Buffer.from("{}"), {
        "pagar-signature": `t=${Math.floor(Date.now() / 1000)},v1=${"0".repeat(64)}`,
        "pagar-event-id": "evt_123",
      })
    ).rejects.toThrow("Invalid Pagar webhook signature");
  });
});
