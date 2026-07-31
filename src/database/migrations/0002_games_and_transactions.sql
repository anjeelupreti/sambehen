CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"code" varchar(50) NOT NULL,
	"category" varchar(80),
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_staff_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"type" varchar(8) NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"game_id" uuid,
	"parent_transaction_id" uuid,
	"status" varchar(12) DEFAULT 'completed' NOT NULL,
	"channel" varchar(50),
	"reference_no" varchar(100),
	"note" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"entered_by_staff_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_transactions_amount_positive" CHECK ("transactions"."amount" > 0),
	CONSTRAINT "chk_transactions_type" CHECK ("transactions"."type" IN ('debit', 'credit')),
	CONSTRAINT "chk_transactions_status" CHECK ("transactions"."status" IN ('pending', 'completed', 'reversed')),
	CONSTRAINT "chk_transactions_correction_is_credit" CHECK ("transactions"."parent_transaction_id" IS NULL OR "transactions"."type" = 'credit'),
	CONSTRAINT "chk_transactions_not_own_parent" CHECK ("transactions"."parent_transaction_id" IS DISTINCT FROM "transactions"."id")
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_parent_transaction_id_transactions_id_fk" FOREIGN KEY ("parent_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_entered_by_staff_id_staff_users_id_fk" FOREIGN KEY ("entered_by_staff_id") REFERENCES "public"."staff_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_games_code" ON "games" USING btree ("code") WHERE "games"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_games_active" ON "games" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_games_category" ON "games" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_transactions_customer_occurred" ON "transactions" USING btree ("customer_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_transactions_type_occurred" ON "transactions" USING btree ("type","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_transactions_game" ON "transactions" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_parent" ON "transactions" USING btree ("parent_transaction_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_entered_by" ON "transactions" USING btree ("entered_by_staff_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_status" ON "transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_transactions_withdrawals" ON "transactions" USING btree ("customer_id","amount") WHERE "transactions"."type" = 'credit' AND "transactions"."parent_transaction_id" IS NULL;