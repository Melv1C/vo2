CREATE TABLE "activities" (
	"user_id" text PRIMARY KEY NOT NULL,
	"activities_count" integer DEFAULT 0 NOT NULL,
	"last_fetched_at" timestamp NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "athlete_created_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "sex" text;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;