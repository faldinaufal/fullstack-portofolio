-- Booking access without a login, cancellation by customers, and linking guest bookings
-- to a verified customer account (FSD 3.2, 4.3, 4.4, 6.7).

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "cancelled_at" TIMESTAMPTZ(3),
ADD COLUMN     "cancelled_by_id" UUID,
ADD COLUMN     "cancelled_by_type" VARCHAR(10);

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelled_by_type_valid"
  CHECK ("cancelled_by_type" IS NULL OR "cancelled_by_type" IN ('customer', 'guest', 'owner', 'manager'));
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancellation_recorded"
  CHECK (("status" = 'cancelled') = ("cancelled_at" IS NOT NULL AND "cancelled_by_type" IS NOT NULL));

-- CreateTable
CREATE TABLE "booking_access_tokens" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "booking_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "booking_access_tokens_token_hash_key" ON "booking_access_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "booking_access_tokens_booking_id_idx" ON "booking_access_tokens"("booking_id");

-- AddForeignKey
ALTER TABLE "booking_access_tokens" ADD CONSTRAINT "booking_access_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_access_tokens" ADD CONSTRAINT "booking_access_tokens_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Row-level security (FSD 4.4)
-- A booking link is opened before any login: the row whose token hash matches is readable
-- (and only that row); the API checks expiry, then switches to the booking's tenant context.
-- ---------------------------------------------------------------------------

CREATE FUNCTION app_booking_token_hash() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.booking_token_hash', true), '') $$;

ALTER TABLE "booking_access_tokens" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "booking_access_tokens" TO tempora_app
  USING ("tenant_id" = app_tenant_id()) WITH CHECK ("tenant_id" = app_tenant_id());
CREATE POLICY "booking_by_token" ON "booking_access_tokens" FOR SELECT TO tempora_app
  USING ("token_hash" = app_booking_token_hash());

REVOKE DELETE ON "booking_access_tokens" FROM tempora_app;

-- ---------------------------------------------------------------------------
-- Linking guest bookings (FSD 3.2 step 5). When a customer verifies their email, their
-- guest records at every business become theirs. That spans tenants, which RLS (correctly)
-- does not allow the API to do, so this runs as the table owner. It trusts nothing from the
-- caller but the account ID: the email is read from the account and must be verified.
-- ---------------------------------------------------------------------------

CREATE FUNCTION link_guest_bookings(p_account_id uuid) RETURNS integer
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
  DECLARE
    v_email varchar;
    v_linked integer;
  BEGIN
    SELECT email INTO v_email
    FROM customer_accounts
    WHERE id = p_account_id AND email_verified_at IS NOT NULL;
    IF v_email IS NULL THEN
      RETURN 0;
    END IF;

    UPDATE tenant_customers
    SET customer_account_id = p_account_id, updated_at = now()
    WHERE email = v_email AND customer_account_id IS NULL;
    GET DIAGNOSTICS v_linked = ROW_COUNT;

    -- The bookings are reachable from "My bookings" now; the guest links are no longer needed.
    UPDATE booking_access_tokens
    SET revoked_at = now()
    WHERE revoked_at IS NULL
      AND booking_id IN (
        SELECT b.id FROM bookings b
        JOIN tenant_customers c ON c.id = b.tenant_customer_id
        WHERE c.customer_account_id = p_account_id
      );

    RETURN v_linked;
  END;
  $$;

REVOKE ALL ON FUNCTION link_guest_bookings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION link_guest_bookings(uuid) TO tempora_app;
