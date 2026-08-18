-- The "runner" role and its columns are renamed to "store" throughout.
-- Existing data is preserved: the customer's owning staff member and the
-- staff row's role are the same account, just relabelled.

ALTER TABLE "staff_users" DROP CONSTRAINT "chk_staff_hierarchy";--> statement-breakpoint
ALTER TABLE "staff_users" DROP CONSTRAINT "chk_staff_role";--> statement-breakpoint

UPDATE "staff_users" SET "role" = 'store' WHERE "role" = 'runner';--> statement-breakpoint

ALTER TABLE "staff_users" ADD CONSTRAINT "chk_staff_hierarchy" CHECK (("staff_users"."role" = 'master' AND "staff_users"."parent_id" IS NULL)
          OR ("staff_users"."role" IN ('manager', 'store') AND "staff_users"."parent_id" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "staff_users" ADD CONSTRAINT "chk_staff_role" CHECK ("staff_users"."role" IN ('master', 'manager', 'store'));--> statement-breakpoint

-- Postgres carries a renamed column's dependents (indexes, FKs, check
-- constraint definitions) along automatically; only the object *names*
-- below don't follow the column, so those are renamed explicitly to match
-- what the schema now declares.
ALTER TABLE "customers" RENAME COLUMN "runner_id" TO "store_id";--> statement-breakpoint
ALTER TABLE "customers" RENAME CONSTRAINT "customers_runner_id_staff_users_id_fk" TO "customers_store_id_staff_users_id_fk";--> statement-breakpoint
ALTER INDEX "idx_customers_runner" RENAME TO "idx_customers_store";
