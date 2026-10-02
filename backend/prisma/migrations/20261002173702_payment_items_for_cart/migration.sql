-- A payment used to be one course. With a cart it covers several, so the
-- course moves out into `payment_items`.
--
-- Hand-edited from the generated migration, which dropped `payments.courseId`
-- outright and would have erased every record of what was bought. The order
-- below matters: create the table, copy the existing rows into it, and only
-- then drop the column.

-- CreateTable
CREATE TABLE "payment_items" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,

    CONSTRAINT "payment_items_pkey" PRIMARY KEY ("id")
);

-- Backfill: one item per existing payment, carrying the amount that was
-- actually charged. gen_random_uuid() is built in from Postgres 13.
INSERT INTO "payment_items" ("id", "paymentId", "courseId", "amountCents")
SELECT gen_random_uuid(), "id", "courseId", "amountCents"
FROM "payments";

-- CreateIndex
CREATE INDEX "payment_items_courseId_idx" ON "payment_items"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_items_paymentId_courseId_key" ON "payment_items"("paymentId", "courseId");

-- AddForeignKey
ALTER TABLE "payment_items" ADD CONSTRAINT "payment_items_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_items" ADD CONSTRAINT "payment_items_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Now the column is redundant.
-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_courseId_fkey";

-- DropIndex
DROP INDEX "payments_courseId_idx";

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "courseId";

-- One cart payment unlocks every course that was in it, so an enrollment's
-- payment reference stops being one-to-one.
-- DropIndex
DROP INDEX "enrollments_paymentId_key";

-- CreateIndex
CREATE INDEX "enrollments_paymentId_idx" ON "enrollments"("paymentId");
