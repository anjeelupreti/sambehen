CREATE TABLE "customer_label_assignments" (
	"customer_id" uuid NOT NULL,
	"label_id" uuid NOT NULL,
	"assigned_by_staff_id" uuid,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_label_assignments_customer_id_label_id_pk" PRIMARY KEY("customer_id","label_id")
);
--> statement-breakpoint
CREATE TABLE "customer_labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(40) NOT NULL,
	"color" varchar(16) DEFAULT 'blue' NOT NULL,
	"created_by_staff_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_label_assignments" ADD CONSTRAINT "customer_label_assignments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_label_assignments" ADD CONSTRAINT "customer_label_assignments_label_id_customer_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."customer_labels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_label_assignments" ADD CONSTRAINT "customer_label_assignments_assigned_by_staff_id_staff_users_id_fk" FOREIGN KEY ("assigned_by_staff_id") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_labels" ADD CONSTRAINT "customer_labels_created_by_staff_id_staff_users_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_customer_label_assignments_label" ON "customer_label_assignments" USING btree ("label_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_customer_labels_name" ON "customer_labels" USING btree (lower("name"));