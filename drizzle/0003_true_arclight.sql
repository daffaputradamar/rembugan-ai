DROP INDEX "idx_templates_type";--> statement-breakpoint
ALTER TABLE "templates" DROP COLUMN "type";--> statement-breakpoint
DROP TYPE "public"."template_type";