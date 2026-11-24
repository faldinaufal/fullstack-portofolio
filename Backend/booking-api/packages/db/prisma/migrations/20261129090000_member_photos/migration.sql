-- Therapist photos (FSD 6.15): object key of a member's photo, shown to customers on the
-- business page and in their bookings. Only the key is stored, like the business images.
ALTER TABLE "memberships" ADD COLUMN "photo_key" VARCHAR(200);
