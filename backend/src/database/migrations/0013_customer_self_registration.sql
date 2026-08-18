-- Customer self-registration: a signup with no staff behind it lands as
-- status = 'pending' with no owner, until a master approves it.

ALTER TABLE "customers" DROP CONSTRAINT "chk_customers_status";--> statement-breakpoint
ALTER TABLE "customers" DROP CONSTRAINT "chk_customers_ownership";--> statement-breakpoint

ALTER TABLE "customers" ALTER COLUMN "owner_staff_id" DROP NOT NULL;--> statement-breakpoint

ALTER TABLE "customers" ADD CONSTRAINT "chk_customers_status" CHECK ("customers"."status" IN ('pending', 'active', 'inactive', 'suspended', 'banned'));--> statement-breakpoint
-- `a = b` is NULL, not FALSE, when both sides are NULL — a CHECK only
-- rejects an expression that evaluates to FALSE, so the non-pending branch
-- spells out IS NOT NULL explicitly rather than trusting the equality to
-- catch an all-null row on its own.
ALTER TABLE "customers" ADD CONSTRAINT "chk_customers_ownership" CHECK (
  ("customers"."status" = 'pending'
   AND "customers"."owner_staff_id" IS NULL AND "customers"."manager_id" IS NULL AND "customers"."store_id" IS NULL)
  OR ("customers"."status" != 'pending'
      AND "customers"."owner_staff_id" IS NOT NULL AND "customers"."manager_id" IS NOT NULL
      AND (("customers"."store_id" IS NULL AND "customers"."owner_staff_id" = "customers"."manager_id")
        OR ("customers"."store_id" IS NOT NULL AND "customers"."owner_staff_id" = "customers"."store_id")))
);
