CREATE TABLE "vip_criteria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"tier" integer DEFAULT 1 NOT NULL,
	"metric" varchar(24) DEFAULT 'total_debit' NOT NULL,
	"threshold_amount" numeric(18, 2) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_staff_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_vip_criteria_period" CHECK ("vip_criteria"."period_end" >= "vip_criteria"."period_start"),
	CONSTRAINT "chk_vip_criteria_threshold" CHECK ("vip_criteria"."threshold_amount" > 0),
	CONSTRAINT "chk_vip_criteria_metric" CHECK ("vip_criteria"."metric" IN ('total_debit', 'net', 'transaction_count')),
	CONSTRAINT "chk_vip_criteria_tier" CHECK ("vip_criteria"."tier" >= 1)
);
--> statement-breakpoint
CREATE TABLE "vip_qualifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"criteria_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"achieved_amount" numeric(18, 2) NOT NULL,
	"threshold_amount" numeric(18, 2) NOT NULL,
	"qualified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vip_qualifications" ADD CONSTRAINT "vip_qualifications_criteria_id_vip_criteria_id_fk" FOREIGN KEY ("criteria_id") REFERENCES "public"."vip_criteria"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vip_qualifications" ADD CONSTRAINT "vip_qualifications_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_vip_criteria_active" ON "vip_criteria" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_vip_criteria_period" ON "vip_criteria" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "idx_vip_criteria_tier" ON "vip_criteria" USING btree ("tier");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_vip_qualifications" ON "vip_qualifications" USING btree ("criteria_id","customer_id");--> statement-breakpoint
CREATE INDEX "idx_vip_qualifications_customer" ON "vip_qualifications" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_vip_qualifications_criteria" ON "vip_qualifications" USING btree ("criteria_id");--> statement-breakpoint
CREATE INDEX "idx_vip_qualifications_qualified_at" ON "vip_qualifications" USING btree ("qualified_at");