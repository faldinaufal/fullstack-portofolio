-- Booking operations in the Console (FSD 6.7): who marked a session completed or no-show,
-- and paid bookings cancelled by the team, refunded outside Tempora.

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "marked_at" TIMESTAMPTZ(3),
ADD COLUMN     "marked_by_membership_id" UUID,
ADD COLUMN     "refund_handled_externally" BOOLEAN NOT NULL DEFAULT false;

-- A finished booking always says when it was marked (by a member, or by the auto-complete
-- job with no member), and only finished bookings carry a mark.
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_mark_recorded"
  CHECK (("status" IN ('completed', 'no_show')) = ("marked_at" IS NOT NULL));
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_refund_only_when_cancelled"
  CHECK (NOT "refund_handled_externally" OR "status" = 'cancelled');

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_marked_by_membership_id_fkey" FOREIGN KEY ("marked_by_membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
