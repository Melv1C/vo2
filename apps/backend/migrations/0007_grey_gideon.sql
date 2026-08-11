ALTER TABLE "activity_subjective" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "activity_subjective" CASCADE;--> statement-breakpoint
CREATE INDEX "athlete_metric_history_user_metric_recorded_at_idx" ON "athlete_metric_history" USING btree ("user_id","metric","recorded_at");