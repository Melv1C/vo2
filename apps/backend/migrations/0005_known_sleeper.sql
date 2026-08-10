CREATE TABLE "activity_metrics" (
	"activity_id" uuid PRIMARY KEY NOT NULL,
	"sport_family" text NOT NULL,
	"training_load" double precision,
	"load_source" text,
	"trimp_banister" double precision,
	"trimp_edwards" double precision,
	"hr_tss" double precision,
	"avg_hr" double precision,
	"max_hr" double precision,
	"moving_time_s" double precision,
	"decoupling_pct" double precision,
	"time_in_zone" jsonb,
	"energy_kcal" double precision,
	"weight_kg_used" double precision,
	"sport_payload" jsonb,
	"data_quality" jsonb NOT NULL,
	"cross_checks" jsonb,
	"anchor_snapshot" jsonb NOT NULL,
	"metrics_version" integer DEFAULT 1 NOT NULL,
	"computed_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_training_load" (
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"training_load" double precision DEFAULT 0 NOT NULL,
	"ctl" double precision DEFAULT 0 NOT NULL,
	"atl" double precision DEFAULT 0 NOT NULL,
	"tsb" double precision DEFAULT 0 NOT NULL,
	"is_ramping" boolean DEFAULT false NOT NULL,
	"activity_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "daily_training_load_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
ALTER TABLE "athlete_profile" ADD COLUMN "threshold_pace_mps" double precision;--> statement-breakpoint
ALTER TABLE "athlete_profile" ADD COLUMN "max_hr_source" text;--> statement-breakpoint
ALTER TABLE "athlete_profile" ADD COLUMN "lthr_source" text;--> statement-breakpoint
ALTER TABLE "athlete_profile" ADD COLUMN "ftp_source" text;--> statement-breakpoint
ALTER TABLE "athlete_profile" ADD COLUMN "threshold_pace_source" text;--> statement-breakpoint
ALTER TABLE "activity_metrics" ADD CONSTRAINT "activity_metrics_activity_id_strava_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."strava_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_training_load" ADD CONSTRAINT "daily_training_load_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;