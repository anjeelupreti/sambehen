CREATE TABLE "staff_conversation_read_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"last_read_message_id" uuid,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_a_id" uuid NOT NULL,
	"staff_b_id" uuid NOT NULL,
	"last_message_at" timestamp with time zone,
	"last_message_preview" varchar(200),
	"message_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_staff_conversations_canonical_order" CHECK ("staff_conversations"."staff_a_id"::text < "staff_conversations"."staff_b_id"::text)
);
--> statement-breakpoint
CREATE TABLE "staff_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_staff_id" uuid NOT NULL,
	"body" text NOT NULL,
	"attachments" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "staff_conversation_read_states" ADD CONSTRAINT "staff_conversation_read_states_conversation_id_staff_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."staff_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_conversation_read_states" ADD CONSTRAINT "staff_conversation_read_states_staff_id_staff_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_conversations" ADD CONSTRAINT "staff_conversations_staff_a_id_staff_users_id_fk" FOREIGN KEY ("staff_a_id") REFERENCES "public"."staff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_conversations" ADD CONSTRAINT "staff_conversations_staff_b_id_staff_users_id_fk" FOREIGN KEY ("staff_b_id") REFERENCES "public"."staff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_messages" ADD CONSTRAINT "staff_messages_conversation_id_staff_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."staff_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_messages" ADD CONSTRAINT "staff_messages_sender_staff_id_staff_users_id_fk" FOREIGN KEY ("sender_staff_id") REFERENCES "public"."staff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_staff_conversation_read_states" ON "staff_conversation_read_states" USING btree ("conversation_id","staff_id");--> statement-breakpoint
CREATE INDEX "idx_staff_conversation_read_states_staff" ON "staff_conversation_read_states" USING btree ("staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_staff_conversations_pair" ON "staff_conversations" USING btree ("staff_a_id","staff_b_id");--> statement-breakpoint
CREATE INDEX "idx_staff_conversations_a" ON "staff_conversations" USING btree ("staff_a_id");--> statement-breakpoint
CREATE INDEX "idx_staff_conversations_b" ON "staff_conversations" USING btree ("staff_b_id");--> statement-breakpoint
CREATE INDEX "idx_staff_conversations_last_message" ON "staff_conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "idx_staff_messages_conversation_created" ON "staff_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_staff_messages_sender" ON "staff_messages" USING btree ("sender_staff_id");