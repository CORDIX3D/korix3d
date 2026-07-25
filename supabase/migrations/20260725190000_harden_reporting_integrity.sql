-- Keep one canonical report and one trend/score row for each logical period.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY report_month, report_type
      ORDER BY generated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS position
  FROM public.accounting_reports
)
DELETE FROM public.accounting_reports AS report
USING ranked
WHERE report.id = ranked.id
  AND ranked.position > 1;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY report_month
      ORDER BY generated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS position
  FROM public.executive_reports
)
DELETE FROM public.executive_reports AS report
USING ranked
WHERE report.id = ranked.id
  AND ranked.position > 1;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY report_id, score_type
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS position
  FROM public.ai_scores_history
  WHERE report_id IS NOT NULL
)
DELETE FROM public.ai_scores_history AS score
USING ranked
WHERE score.id = ranked.id
  AND ranked.position > 1;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY metric_key, period_start, period_end
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS position
  FROM public.monthly_trends
)
DELETE FROM public.monthly_trends AS trend
USING ranked
WHERE trend.id = ranked.id
  AND ranked.position > 1;

-- Notifications are generated only for an executive report. Old ON DELETE
-- SET NULL behavior could leave records that no longer belong to any report.
DELETE FROM public.ai_notifications
WHERE report_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_accounting_reports_period_type
  ON public.accounting_reports (report_month, report_type);

CREATE UNIQUE INDEX IF NOT EXISTS uq_executive_reports_month
  ON public.executive_reports (report_month);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_scores_report_type
  ON public.ai_scores_history (report_id, score_type)
  WHERE report_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_monthly_trends_metric_period
  ON public.monthly_trends (metric_key, period_start, period_end);

ALTER TABLE public.ai_notifications
  DROP CONSTRAINT IF EXISTS ai_notifications_report_id_fkey;

ALTER TABLE public.ai_notifications
  ADD CONSTRAINT ai_notifications_report_id_fkey
  FOREIGN KEY (report_id)
  REFERENCES public.executive_reports(id)
  ON DELETE CASCADE;
