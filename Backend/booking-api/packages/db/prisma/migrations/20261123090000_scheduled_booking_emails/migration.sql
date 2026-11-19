-- Scheduled booking emails (FSD 6.1 reminder, 6.5): the reminder is queued in the outbox at
-- confirmation with a future `next_attempt_at`. It names its booking and the start time it
-- was written for; the worker sends it only if the booking still matches, so a cancelled or
-- rescheduled booking never gets a reminder for the old time.

-- AlterEnum
ALTER TYPE "email_status" ADD VALUE 'skipped';

-- AlterTable
ALTER TABLE "email_messages" ADD COLUMN     "booking_id" UUID,
ADD COLUMN     "booking_starts_at" TIMESTAMPTZ(3);

ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_booking_pair"
  CHECK (("booking_id" IS NULL) = ("booking_starts_at" IS NULL));

-- CreateIndex
CREATE INDEX "email_messages_booking_id_idx" ON "email_messages"("booking_id");

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
