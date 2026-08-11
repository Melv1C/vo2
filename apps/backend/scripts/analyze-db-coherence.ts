/**
 * Audits metrics table coherence: activity_metrics ↔ daily_training_load,
 * stream coverage, load sources, and cross-check downgrades.
 *
 * Run: bun run db:audit
 */
import "varlock/auto-load";
import { sql } from "drizzle-orm";

import { dbWithoutLogging as db } from "@/database/client";

type Row = Record<string, unknown>;

async function query<T extends Row>(label: string, sqlQuery: ReturnType<typeof sql>): Promise<T[]> {
  const result = await db.execute(sqlQuery);
  const rows = (result as { rows?: T[] }).rows ?? (result as unknown as T[]);
  console.log(`\n=== ${label} ===`);
  if (rows.length === 0) {
    console.log("(no rows)");
    return rows;
  }
  console.table(rows);
  return rows;
}

async function main() {
  console.log("Metrics database coherence audit\n");

  await query(
    "Users",
    sql`
      select u.id, u.name, u.email
      from "user" u
      order by u.created_at desc
      limit 10
    `,
  );

  await query(
    "Table row counts",
    sql`
      select 'strava_activities' as table_name, count(*)::int as rows from strava_activities
      union all select 'activity_streams', count(*)::int from activity_streams
      union all select 'activity_metrics', count(*)::int from activity_metrics
      union all select 'daily_training_load', count(*)::int from daily_training_load
      union all select 'athlete_profile', count(*)::int from athlete_profile
      union all select 'athlete_metric_history', count(*)::int from athlete_metric_history
      order by table_name
    `,
  );

  await query(
    "Activities vs metrics coverage (per user)",
    sql`
      select
        sa.user_id,
        count(*)::int as activities,
        count(am.activity_id)::int as with_metrics,
        count(*) filter (where sa.streams_status = 'ready')::int as streams_ready,
        count(*) filter (where sa.streams_status = 'pending')::int as streams_pending,
        count(*) filter (where sa.streams_status = 'skipped')::int as streams_skipped,
        count(*) filter (where sa.streams_status = 'ready' and am.activity_id is null)::int as ready_without_metrics,
        count(*) filter (where am.training_load is not null)::int as with_training_load,
        count(*) filter (where am.training_load is null and am.activity_id is not null)::int as metrics_null_load
      from strava_activities sa
      left join activity_metrics am on am.activity_id = sa.id
      group by sa.user_id
    `,
  );

  await query(
    "Streams status vs average HR (skip reason)",
    sql`
      select
        streams_status,
        count(*) filter (where average_heartrate is null)::int as without_summary_hr,
        count(*) filter (where average_heartrate is not null)::int as with_summary_hr,
        count(*)::int as total
      from strava_activities
      group by streams_status
      order by total desc
    `,
  );

  await query(
    "Metrics version distribution",
    sql`
    select metrics_version, count(*)::int as rows
    from activity_metrics
    group by metrics_version
    order by metrics_version
  `,
  );

  await query(
    "Load source distribution",
    sql`
      select load_source, count(*)::int as rows,
        round(avg(training_load)::numeric, 1) as avg_load,
        round(min(training_load)::numeric, 1) as min_load,
        round(max(training_load)::numeric, 1) as max_load
      from activity_metrics
      where training_load is not null
      group by load_source
      order by rows desc
    `,
  );

  await query(
    "Sport family distribution",
    sql`
      select sport_family, count(*)::int as rows,
        count(*) filter (where training_load is not null)::int as with_load
      from activity_metrics
      group by sport_family
      order by rows desc
    `,
  );

  await query(
    "Ready activities missing metrics (sample)",
    sql`
      select sa.id, sa.sport_type, sa.streams_status, sa.start_date_local::date as local_date
      from strava_activities sa
      left join activity_metrics am on am.activity_id = sa.id
      where sa.streams_status = 'ready' and am.activity_id is null
      order by sa.start_date_local desc
      limit 20
    `,
  );

  await query(
    "Metrics with null training_load (sample)",
    sql`
      select am.activity_id, am.sport_family, am.metrics_version,
        am.data_quality->>'coveragePct' as coverage_pct,
        am.avg_hr, am.hr_tss, am.load_source
      from activity_metrics am
      where am.training_load is null
      order by am.computed_at desc
      limit 20
    `,
  );

  await query(
    "Daily training load span (per user)",
    sql`
      select
        user_id,
        count(*)::int as days,
        min(date)::text as first_date,
        max(date)::text as last_date,
        sum(activity_count)::int as sum_activity_count,
        round(sum(training_load)::numeric, 1) as sum_daily_load,
        round(max(ctl)::numeric, 1) as max_ctl,
        round(max(atl)::numeric, 1) as max_atl
      from daily_training_load
      group by user_id
    `,
  );

  const loadTotals = await query<{ sum_activity_load: string; sum_daily_load: string }>(
    "Sum activity training_load vs daily_training_load",
    sql`
      select
        (select round(sum(training_load)::numeric, 1) from activity_metrics)::text as sum_activity_load,
        (select round(sum(training_load)::numeric, 1) from daily_training_load)::text as sum_daily_load
    `,
  );

  const mismatches = await query(
    "Daily load vs activity_metrics mismatches",
    sql`
      with activity_daily as (
        select
          sa.user_id,
          coalesce(date(sa.start_date_local), date(sa.start_date)) as d,
          round(sum(am.training_load)::numeric, 4) as load_from_activities,
          count(am.activity_id)::int as activity_count
        from strava_activities sa
        inner join activity_metrics am on am.activity_id = sa.id
        where am.training_load is not null
        group by sa.user_id, coalesce(date(sa.start_date_local), date(sa.start_date))
      )
      select
        dtl.user_id,
        dtl.date::text as date,
        dtl.training_load as dtl_load,
        ad.load_from_activities,
        dtl.activity_count as dtl_count,
        ad.activity_count as am_count,
        abs(dtl.training_load - ad.load_from_activities) as load_diff
      from daily_training_load dtl
      inner join activity_daily ad on ad.user_id = dtl.user_id and ad.d = dtl.date
      where abs(dtl.training_load - ad.load_from_activities) > 0.01
         or dtl.activity_count <> ad.activity_count
      order by load_diff desc
      limit 20
    `,
  );

  await query(
    "Activity days missing from daily_training_load",
    sql`
      with activity_daily as (
        select distinct
          sa.user_id,
          coalesce(date(sa.start_date_local), date(sa.start_date)) as d
        from strava_activities sa
        inner join activity_metrics am on am.activity_id = sa.id
        where am.training_load is not null
      )
      select ad.user_id, ad.d::text as date
      from activity_daily ad
      left join daily_training_load dtl on dtl.user_id = ad.user_id and dtl.date = ad.d
      where dtl.user_id is null
      order by ad.d desc
      limit 20
    `,
  );

  await query(
    "Zero-load rest days in daily_training_load",
    sql`
      select
        count(*) filter (where training_load = 0 and activity_count = 0)::int as rest_days,
        count(*) filter (where training_load > 0)::int as training_days,
        count(*)::int as total_days
      from daily_training_load
    `,
  );

  await query(
    "CTL/ATL/TSB recent (last 10 days)",
    sql`
      select date::text, training_load, round(ctl::numeric, 2) as ctl,
        round(atl::numeric, 2) as atl, round(tsb::numeric, 2) as tsb,
        activity_count, is_ramping
      from daily_training_load
      order by date desc
      limit 10
    `,
  );

  await query(
    "Athlete profile anchors",
    sql`
      select user_id, sex, max_hr, resting_hr, lthr, ftp,
        round(threshold_pace_mps::numeric, 3) as run_pace_mps,
        round(threshold_swim_pace_mps::numeric, 3) as swim_css_mps,
        max_hr_source, lthr_source, ftp_source, threshold_pace_source, threshold_swim_pace_source
      from athlete_profile
    `,
  );

  await query(
    "Cross-check summary",
    sql`
      select
        count(*) filter (where cross_checks->>'downgraded' = 'true')::int as downgraded,
        count(*) filter (where cross_checks->>'coverageOk' = 'false')::int as coverage_not_ok,
        count(*) filter (where cross_checks->>'decouplingSanity' = 'false')::int as decoupling_fail,
        count(*)::int as total
      from activity_metrics
      where cross_checks is not null
    `,
  );

  await query(
    "Downgrades by sport and load source",
    sql`
      select load_source, sport_family, count(*)::int as rows
      from activity_metrics
      where cross_checks->>'downgraded' = 'true'
      group by load_source, sport_family
      order by rows desc
    `,
  );

  await query(
    "Swim activities",
    sql`
      select
        count(*) filter (where sa.sport_type = 'Swim')::int as swim_activities,
        count(*) filter (where sa.sport_type = 'Swim' and am.activity_id is not null)::int as swim_with_metrics,
        count(*) filter (where am.sport_family = 'swimming')::int as swim_family_metrics,
        count(*) filter (where am.load_source = 's_tss')::int as s_tss_loads,
        count(*) filter (where am.sport_family = 'swimming' and am.sport_payload is null)::int as swim_without_payload
      from strava_activities sa
      left join activity_metrics am on am.activity_id = sa.id
    `,
  );

  await query(
    "Frontend 90-day window vs total daily rows",
    sql`
      select
        count(*) filter (where date >= current_date - interval '90 days')::int as days_in_last_90,
        count(*)::int as total_days
      from daily_training_load
    `,
  );

  await query(
    "Metrics computed_at range",
    sql`
      select min(computed_at)::text as first, max(computed_at)::text as last
      from activity_metrics
    `,
  );

  const coverage = await query<{ ready_without_metrics: number; metrics_null_load: number }>(
    "Coherence flags",
    sql`
      select
        count(*) filter (where sa.streams_status = 'ready' and am.activity_id is null)::int as ready_without_metrics,
        count(*) filter (where am.training_load is null and am.activity_id is not null)::int as metrics_null_load
      from strava_activities sa
      left join activity_metrics am on am.activity_id = sa.id
    `,
  );

  const activityLoad = loadTotals[0]?.sum_activity_load;
  const dailyLoad = loadTotals[0]?.sum_daily_load;
  const loadSumOk = activityLoad != null && activityLoad === dailyLoad;

  const issues: string[] = [];
  if ((coverage[0]?.ready_without_metrics ?? 0) > 0) {
    issues.push(`${coverage[0]?.ready_without_metrics} ready activities missing metrics`);
  }
  if ((coverage[0]?.metrics_null_load ?? 0) > 0) {
    issues.push(`${coverage[0]?.metrics_null_load} metric rows with null training_load`);
  }
  if (mismatches.length > 0) {
    issues.push(`${mismatches.length} daily rollup mismatches`);
  }
  if (!loadSumOk && activityLoad != null && dailyLoad != null) {
    issues.push(`load sum mismatch: activities=${activityLoad} daily=${dailyLoad}`);
  }

  console.log("\n=== Summary ===");
  if (issues.length === 0) {
    console.log("OK — no coherence issues detected.");
    process.exit(0);
  }

  console.log("ISSUES:");
  for (const issue of issues) {
    console.log(`  - ${issue}`);
  }
  process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
