CREATE TABLE "template_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" uuid NOT NULL,
	"role_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "template_roles" ADD CONSTRAINT "template_roles_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_template_roles_template_id" ON "template_roles" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_template_roles_role_id" ON "template_roles" USING btree ("role_id");