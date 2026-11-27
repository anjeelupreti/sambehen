CREATE TABLE "big_wins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"game_id" uuid,
	"amount" numeric(18, 2) NOT NULL,
	"won_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hidden_at" timestamp with time zone,
	"recorded_by_staff_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_big_wins_amount" CHECK ("big_wins"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "show_in_wins" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "big_wins" ADD CONSTRAINT "big_wins_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "big_wins" ADD CONSTRAINT "big_wins_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "big_wins" ADD CONSTRAINT "big_wins_recorded_by_staff_id_staff_users_id_fk" FOREIGN KEY ("recorded_by_staff_id") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_big_wins_won_at" ON "big_wins" USING btree ("won_at");--> statement-breakpoint
CREATE INDEX "idx_big_wins_customer" ON "big_wins" USING btree ("customer_id");