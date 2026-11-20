-- Email log per branch (FSD 2.2, 5.4): a manager sees the emails about their branch (booking
-- emails and staff invitations). Kept apart from `booking_id`, which only scheduled emails
-- carry: the worker skips those once the booking changes.

-- AlterTable
ALTER TABLE "email_messages" ADD COLUMN     "branch_id" UUID;

-- CreateIndex
CREATE INDEX "email_messages_branch_id_created_at_idx" ON "email_messages"("branch_id", "created_at");

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing scheduled booking emails already name their booking, so their branch is known.
UPDATE "email_messages" AS e SET "branch_id" = b."branch_id"
FROM "bookings" AS b
WHERE e."booking_id" = b."id";
