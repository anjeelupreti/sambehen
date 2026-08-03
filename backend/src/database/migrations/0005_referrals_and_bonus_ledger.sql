CREATE TABLE "bonus_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"referral_id" uuid,
	"direction" varchar(8) NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"reason" varchar(64) NOT NULL,
	"note" text,
	"created_by_staff_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_bonus_ledger_direction" CHECK ("bonus_ledger"."direction" IN ('credit', 'debit')),
	CONSTRAINT "chk_bonus_ledger_amount" CHECK ("bonus_ledger"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "referral_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"code" varchar(16) NOT NULL,
	"link_slug" varchar(32) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"max_uses" integer,
	"expires_at" timestamp with time zone,
	"assigned_by_staff_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_referral_codes_usage" CHECK ("referral_codes"."usage_count" >= 0),
	CONSTRAINT "chk_referral_codes_max_uses" CHECK ("referral_codes"."max_uses" IS NULL OR "referral_codes"."max_uses" > 0)
);
--> statement-breakpoint
CREATE TABLE "referral_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"reward_type" varchar(12) DEFAULT 'fixed' NOT NULL,
	"referrer_bonus" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"referee_bonus" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"min_qualifying_debit" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"max_rewards_per_referrer" integer,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_staff_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_referral_programs_type" CHECK ("referral_programs"."reward_type" IN ('fixed', 'percentage')),
	CONSTRAINT "chk_referral_programs_referrer_bonus" CHECK ("referral_programs"."referrer_bonus" >= 0),
	CONSTRAINT "chk_referral_programs_referee_bonus" CHECK ("referral_programs"."referee_bonus" >= 0),
	CONSTRAINT "chk_referral_programs_min_debit" CHECK ("referral_programs"."min_qualifying_debit" >= 0),
	CONSTRAINT "chk_referral_programs_validity" CHECK ("referral_programs"."valid_to" IS NULL OR "referral_programs"."valid_to" >= "referral_programs"."valid_from"),
	CONSTRAINT "chk_referral_programs_max_rewards" CHECK ("referral_programs"."max_rewards_per_referrer" IS NULL OR "referral_programs"."max_rewards_per_referrer" > 0)
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"referrer_customer_id" uuid NOT NULL,
	"referee_customer_id" uuid NOT NULL,
	"status" varchar(12) DEFAULT 'pending' NOT NULL,
	"referrer_reward" numeric(18, 2),
	"referee_reward" numeric(18, 2),
	"qualified_at" timestamp with time zone,
	"rewarded_at" timestamp with time zone,
	"rejected_reason" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_referrals_status" CHECK ("referrals"."status" IN ('pending', 'qualified', 'rewarded', 'rejected')),
	CONSTRAINT "chk_referrals_not_self" CHECK ("referrals"."referrer_customer_id" <> "referrals"."referee_customer_id")
);
--> statement-breakpoint
ALTER TABLE "bonus_ledger" ADD CONSTRAINT "bonus_ledger_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bonus_ledger" ADD CONSTRAINT "bonus_ledger_referral_id_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."referrals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bonus_ledger" ADD CONSTRAINT "bonus_ledger_created_by_staff_id_staff_users_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_program_id_referral_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."referral_programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_assigned_by_staff_id_staff_users_id_fk" FOREIGN KEY ("assigned_by_staff_id") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_code_id_referral_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."referral_codes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_program_id_referral_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."referral_programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_customer_id_customers_id_fk" FOREIGN KEY ("referrer_customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referee_customer_id_customers_id_fk" FOREIGN KEY ("referee_customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_bonus_ledger_referral_reason" ON "bonus_ledger" USING btree ("referral_id","reason") WHERE "bonus_ledger"."referral_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_bonus_ledger_customer" ON "bonus_ledger" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_bonus_ledger_created" ON "bonus_ledger" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_referral_codes_code" ON "referral_codes" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_referral_codes_slug" ON "referral_codes" USING btree ("link_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_referral_codes_customer_program" ON "referral_codes" USING btree ("customer_id","program_id");--> statement-breakpoint
CREATE INDEX "idx_referral_codes_customer" ON "referral_codes" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_referral_codes_program" ON "referral_codes" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "idx_referral_programs_active" ON "referral_programs" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_referral_programs_validity" ON "referral_programs" USING btree ("valid_from","valid_to");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_referrals_referee" ON "referrals" USING btree ("referee_customer_id");--> statement-breakpoint
CREATE INDEX "idx_referrals_referrer" ON "referrals" USING btree ("referrer_customer_id");--> statement-breakpoint
CREATE INDEX "idx_referrals_status" ON "referrals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_referrals_program" ON "referrals" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "idx_referrals_code" ON "referrals" USING btree ("code_id");