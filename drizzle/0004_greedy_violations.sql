CREATE TYPE "public"."transcription_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "transcription_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_size" integer NOT NULL,
	"status" "transcription_status" DEFAULT 'pending' NOT NULL,
	"operation_name" varchar(500),
	"gcs_uri" varchar(500),
	"language" varchar(10) DEFAULT 'id-ID' NOT NULL,
	"result" text,
	"word_count" integer,
	"error" text,
	"user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "transcription_tasks" ADD CONSTRAINT "transcription_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_transcription_tasks_user_id" ON "transcription_tasks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_transcription_tasks_status" ON "transcription_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_transcription_tasks_created_at" ON "transcription_tasks" USING btree ("created_at");