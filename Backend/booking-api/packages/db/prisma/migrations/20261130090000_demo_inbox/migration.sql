-- Demo inbox (FSD 4.3, 4.4, 10.3). With DEMO_MODE on, the worker renders emails to the demo
-- address domain into this table instead of sending them, and the public demo inbox reads it.
-- Everything in it is public by design (only demo addresses land here), so it has no tenant and
-- no RLS. Least privilege instead: the worker may only add and remove rows, the API only read.

-- CreateTable
CREATE TABLE "demo_emails" (
    "id" UUID NOT NULL,
    "to_email" VARCHAR(254) NOT NULL,
    "template" VARCHAR(60) NOT NULL,
    "subject" VARCHAR(300) NOT NULL,
    "text_body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "demo_emails_to_email_created_at_idx" ON "demo_emails"("to_email", "created_at");

-- CreateIndex
CREATE INDEX "demo_emails_created_at_idx" ON "demo_emails"("created_at");

-- New tables get full data rights for the API by default (init migration); it only reads this one.
REVOKE INSERT, UPDATE, DELETE ON "demo_emails" FROM tempora_app;
GRANT SELECT ON "demo_emails" TO tempora_app;

-- The worker writes rendered emails and removes old ones (24 h, newest 500). It selects ids to
-- find the old rows, but has no UPDATE: a stored email never changes.
GRANT SELECT, INSERT, DELETE ON "demo_emails" TO tempora_jobs;
