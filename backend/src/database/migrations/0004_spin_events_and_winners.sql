CREATE TABLE "spin_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"vip_criteria_id" uuid NOT NULL,
	"selection_mode" varchar(16) NOT NULL,
	"status" varchar(12) DEFAULT 'scheduled' NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"prize_description" text,
	"prize_pool" numeric(18, 2),
	"created_by_staff_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_spin_events_mode" CHECK ("spin_events"."selection_mode" IN ('preselected', 'post_draw')),
	CONSTRAINT "chk_spin_events_status" CHECK ("spin_events"."status" IN ('scheduled', 'live', 'completed', 'cancelled')),
	CONSTRAINT "chk_spin_events_prize_pool" CHECK ("spin_events"."prize_pool" IS NULL OR "spin_events"."prize_pool" >= 0)
);
--> statement-breakpoint
CREATE TABLE "spin_winners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spin_event_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"prize_label" varchar(200),
	"prize_amount" numeric(18, 2),
	"rank" integer DEFAULT 1 NOT NULL,
	"is_preselected" boolean DEFAULT false NOT NULL,
	"announced_at" timestamp with time zone,
	"recorded_by_staff_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_spin_winners_rank" CHECK ("spin_winners"."rank" >= 1),
	CONSTRAINT "chk_spin_winners_prize_amount" CHECK ("spin_winners"."prize_amount" IS NULL OR "spin_winners"."prize_amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "spin_events" ADD CONSTRAINT "spin_events_vip_criteria_id_vip_criteria_id_fk" FOREIGN KEY ("vip_criteria_id") REFERENCES "public"."vip_criteria"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spin_events" ADD CONSTRAINT "spin_events_created_by_staff_id_staff_users_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spin_winners" ADD CONSTRAINT "spin_winners_spin_event_id_spin_events_id_fk" FOREIGN KEY ("spin_event_id") REFERENCES "public"."spin_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spin_winners" ADD CONSTRAINT "spin_winners_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spin_winners" ADD CONSTRAINT "spin_winners_recorded_by_staff_id_staff_users_id_fk" FOREIGN KEY ("recorded_by_staff_id") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_spin_events_criteria" ON "spin_events" USING btree ("vip_criteria_id");--> statement-breakpoint
CREATE INDEX "idx_spin_events_status" ON "spin_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_spin_events_scheduled" ON "spin_events" USING btree ("scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_spin_winners" ON "spin_winners" USING btree ("spin_event_id","customer_id");--> statement-breakpoint
CREATE INDEX "idx_spin_winners_customer" ON "spin_winners" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_spin_winners_event" ON "spin_winners" USING btree ("spin_event_id");--> statement-breakpoint
CREATE INDEX "idx_spin_winners_announced" ON "spin_winners" USING btree ("announced_at");