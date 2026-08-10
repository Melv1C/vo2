CREATE TABLE "activity_sync_state" (
	"user_id" text PRIMARY KEY NOT NULL,
	"streams_since" timestamp,
	"summaries_backfill_complete" boolean DEFAULT false NOT NULL,
	"summaries_cursor" integer,
	"streams_backfill_cursor" text,
	"last_summary_synced_at" timestamp,
	"last_stream_synced_at" timestamp,
	"activities_count" integer DEFAULT 0 NOT NULL,
	"streams_ready_count" integer DEFAULT 0 NOT NULL,
	"streams_pending_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "athlete_metric_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"metric" text NOT NULL,
	"value" double precision NOT NULL,
	"recorded_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "athlete_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"athlete_created_at" timestamp,
	"sex" text,
	"birthdate" date,
	"height_cm" double precision,
	"weight_kg" double precision,
	"resting_hr" integer,
	"max_hr" integer,
	"lthr" integer,
	"ftp" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "athlete_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"zones" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_streams" (
	"activity_id" uuid PRIMARY KEY NOT NULL,
	"resolution" text,
	"original_size" integer,
	"series_type" text,
	"time_s" double precision[],
	"distance_m" double precision[],
	"lat" double precision[],
	"lng" double precision[],
	"altitude_m" double precision[],
	"velocity_mps" double precision[],
	"heartrate" double precision[],
	"cadence" double precision[],
	"watts" double precision[],
	"temp_c" double precision[],
	"moving" boolean[],
	"grade_pct" double precision[],
	"fetched_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_subjective" (
	"activity_id" uuid PRIMARY KEY NOT NULL,
	"rpe" integer,
	"fatigue" integer,
	"muscular_feel" integer,
	"cardio_feel" integer,
	"pain" integer,
	"notes" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strava_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"strava_activity_id" text NOT NULL,
	"sport_type" text,
	"name" text,
	"start_date" timestamp NOT NULL,
	"start_date_local" timestamp,
	"timezone" text,
	"distance" double precision,
	"moving_time" integer,
	"elapsed_time" integer,
	"total_elevation_gain" double precision,
	"elev_high" double precision,
	"elev_low" double precision,
	"average_speed" double precision,
	"max_speed" double precision,
	"workout_type" integer,
	"gear_id" text,
	"average_heartrate" double precision,
	"max_heartrate" double precision,
	"average_cadence" double precision,
	"average_watts" double precision,
	"weighted_average_watts" integer,
	"max_watts" integer,
	"kilojoules" double precision,
	"calories" double precision,
	"streams_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "activities" CASCADE;--> statement-breakpoint
ALTER TABLE "activity_sync_state" ADD CONSTRAINT "activity_sync_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_metric_history" ADD CONSTRAINT "athlete_metric_history_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_profile" ADD CONSTRAINT "athlete_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_zones" ADD CONSTRAINT "athlete_zones_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_streams" ADD CONSTRAINT "activity_streams_activity_id_strava_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."strava_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_subjective" ADD CONSTRAINT "activity_subjective_activity_id_strava_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."strava_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strava_activities" ADD CONSTRAINT "strava_activities_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "athlete_zones_user_type_uidx" ON "athlete_zones" USING btree ("user_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "strava_activities_user_strava_id_uidx" ON "strava_activities" USING btree ("user_id","strava_activity_id");--> statement-breakpoint
CREATE INDEX "strava_activities_user_start_date_idx" ON "strava_activities" USING btree ("user_id","start_date");--> statement-breakpoint
CREATE INDEX "strava_activities_user_streams_status_idx" ON "strava_activities" USING btree ("user_id","streams_status");--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "athlete_created_at";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "sex";