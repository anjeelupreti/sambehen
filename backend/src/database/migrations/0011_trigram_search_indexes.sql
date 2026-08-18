CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "idx_staff_users_username_trgm" ON "staff_users" USING gin ("username" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_staff_users_first_name_trgm" ON "staff_users" USING gin ("first_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_staff_users_last_name_trgm" ON "staff_users" USING gin ("last_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_staff_users_email_trgm" ON "staff_users" USING gin ("email" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_customers_email_trgm" ON "customers" USING gin ("email" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_customers_username_trgm" ON "customers" USING gin ("username" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_customers_full_name_trgm" ON "customers" USING gin ("full_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_customers_phone_trgm" ON "customers" USING gin ("phone" gin_trgm_ops);