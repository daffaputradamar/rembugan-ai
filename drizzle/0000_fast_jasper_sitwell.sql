CREATE TYPE "public"."template_type" AS ENUM('mom', 'urd', 'analysis_design', 'test_scenario', 'custom');--> statement-breakpoint
CREATE TYPE "public"."template_visibility" AS ENUM('public', 'division', 'department', 'custom');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "template_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" uuid NOT NULL,
	"user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"type" "template_type" DEFAULT 'custom' NOT NULL,
	"markdown" text NOT NULL,
	"raw_text" text,
	"file_name" varchar(255),
	"visibility" "template_visibility" DEFAULT 'public' NOT NULL,
	"division_id" integer,
	"department_id" integer,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"npk" varchar(50),
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"status" "user_status" DEFAULT 'PENDING' NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "template_users" ADD CONSTRAINT "template_users_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_users" ADD CONSTRAINT "template_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_template_users_template_id" ON "template_users" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_template_users_user_id" ON "template_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_templates_user_id" ON "templates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_templates_visibility" ON "templates" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "idx_templates_type" ON "templates" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_templates_division_id" ON "templates" USING btree ("division_id");--> statement-breakpoint
CREATE INDEX "idx_templates_department_id" ON "templates" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_npk" ON "users" USING btree ("npk");