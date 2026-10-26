ALTER TYPE "PaymentProvider" ADD VALUE 'PAGAR_MPESA';
ALTER TYPE "PaymentProvider" ADD VALUE 'PAGAR_EMOLA';
ALTER TABLE "payments" ADD COLUMN "payerPhone" TEXT;

CREATE TABLE "payment_webhook_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_webhook_events_eventId_key" ON "payment_webhook_events"("eventId");
