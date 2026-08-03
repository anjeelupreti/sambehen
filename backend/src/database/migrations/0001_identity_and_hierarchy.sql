CREATE TABLE "staff_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(100) NOT NULL,
	"password_hash" text NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"phone" varchar(32),
	"role" varchar(16) NOT NULL,
	"parent_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_by_staff_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_staff_hierarchy" CHECK (("staff_users"."role" = 'master' AND "staff_users"."parent_id" IS NULL)
          OR ("staff_users"."role" IN ('manager', 'runner') AND "staff_users"."parent_id" IS NOT NULL)),
	CONSTRAINT "chk_staff_role" CHECK ("staff_users"."role" IN ('master', 'manager', 'runner')),
	CONSTRAINT "chk_staff_not_own_parent" CHECK ("staff_users"."parent_id" IS DISTINCT FROM "staff_users"."id")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(100) NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" varchar(200),
	"phone" varchar(32),
	"city" varchar(120),
	"state" varchar(120),
	"country" varchar(120),
	"owner_staff_id" uuid NOT NULL,
	"manager_id" uuid,
	"runner_id" uuid,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"balance" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"bonus_balance" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"referred_by_customer_id" uuid,
	"last_activity_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email_opt_out" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_by_staff_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_customers_status" CHECK ("customers"."status" IN ('active', 'inactive', 'suspended', 'banned')),
	CONSTRAINT "chk_customers_ownership" CHECK (("customers"."runner_id" IS NULL AND "customers"."owner_staff_id" = "customers"."manager_id")
          OR ("customers"."runner_id" IS NOT NULL AND "customers"."owner_staff_id" = "customers"."runner_id" AND "customers"."manager_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" varchar(16) NOT NULL,
	"subject_id" uuid NOT NULL,
	"refresh_token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" varchar(40),
	"replaced_by_session_id" uuid,
	"ip" varchar(45),
	"user_agent" text,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_users" ADD CONSTRAINT "staff_users_parent_id_staff_users_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."staff_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_owner_staff_id_staff_users_id_fk" FOREIGN KEY ("owner_staff_id") REFERENCES "public"."staff_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_manager_id_staff_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."staff_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_runner_id_staff_users_id_fk" FOREIGN KEY ("runner_id") REFERENCES "public"."staff_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_staff_id_staff_users_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_staff_users_email" ON "staff_users" USING btree ("email") WHERE "staff_users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_staff_users_username" ON "staff_users" USING btree ("username") WHERE "staff_users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_staff_users_role" ON "staff_users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_staff_users_parent" ON "staff_users" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_staff_users_active" ON "staff_users" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_customers_email" ON "customers" USING btree ("email") WHERE "customers"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_customers_username" ON "customers" USING btree ("username") WHERE "customers"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_customers_manager" ON "customers" USING btree ("manager_id");--> statement-breakpoint
CREATE INDEX "idx_customers_runner" ON "customers" USING btree ("runner_id");--> statement-breakpoint
CREATE INDEX "idx_customers_owner" ON "customers" USING btree ("owner_staff_id");--> statement-breakpoint
CREATE INDEX "idx_customers_status" ON "customers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_customers_city" ON "customers" USING btree ("city");--> statement-breakpoint
CREATE INDEX "idx_customers_last_activity" ON "customers" USING btree ("last_activity_at");--> statement-breakpoint
CREATE INDEX "idx_customers_referred_by" ON "customers" USING btree ("referred_by_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_auth_sessions_token_hash" ON "auth_sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX "idx_auth_sessions_subject" ON "auth_sessions" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "idx_auth_sessions_expires" ON "auth_sessions" USING btree ("expires_at");