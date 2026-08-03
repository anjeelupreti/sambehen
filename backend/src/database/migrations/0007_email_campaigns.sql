CREATE TABLE "email_campaign_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"status" varchar(10) DEFAULT 'pending' NOT NULL,
	"provider_message_id" varchar(255),
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_email_recipients_status" CHECK ("email_campaign_recipients"."status" IN ('pending', 'sending', 'sent', 'failed', 'bounced'))
);
--> statement-breakpoint
CREATE TABLE "email_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" varchar(255) NOT NULL,
	"body_html" text,
	"body_text" text NOT NULL,
	"status" varchar(12) DEFAULT 'draft' NOT NULL,
	"filter_snapshot" jsonb,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_by_staff_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_email_campaigns_status" CHECK ("email_campaigns"."status" IN ('draft', 'queued', 'sending', 'sent', 'partial', 'failed', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "email_campaign_recipients" ADD CONSTRAINT "email_campaign_recipients_campaign_id_email_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."email_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_campaign_recipients" ADD CONSTRAINT "email_campaign_recipients_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_created_by_staff_id_staff_users_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_email_recipients" ON "email_campaign_recipients" USING btree ("campaign_id","customer_id");--> statement-breakpoint
CREATE INDEX "idx_email_recipients_claim" ON "email_campaign_recipients" USING btree ("status","campaign_id");--> statement-breakpoint
CREATE INDEX "idx_email_recipients_customer" ON "email_campaign_recipients" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_email_campaigns_status" ON "email_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_email_campaigns_scheduled" ON "email_campaigns" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_email_campaigns_creator" ON "email_campaigns" USING btree ("created_by_staff_id");