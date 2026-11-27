CREATE TABLE "notification_preferences" (
	"realm" varchar(10) NOT NULL,
	"owner_id" uuid NOT NULL,
	"kind" varchar(40) NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_realm_owner_id_kind_pk" PRIMARY KEY("realm","owner_id","kind")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"realm" varchar(10) NOT NULL,
	"recipient_id" uuid NOT NULL,
	"kind" varchar(40) NOT NULL,
	"title" varchar(160) NOT NULL,
	"body" text,
	"link" varchar(300),
	"data" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"realm" varchar(10) NOT NULL,
	"owner_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_notifications_recipient" ON "notifications" USING btree ("realm","recipient_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_push_subscriptions_endpoint" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "idx_push_subscriptions_owner" ON "push_subscriptions" USING btree ("realm","owner_id");