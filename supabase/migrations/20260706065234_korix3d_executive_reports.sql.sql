-- AI Executive Reports
CREATE TABLE IF NOT EXISTS executive_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_month DATE NOT NULL,
  report_year INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  full_report JSONB DEFAULT '{}',
  scores JSONB DEFAULT '{}',
  recommendations JSONB DEFAULT '{}',
  risks JSONB DEFAULT '{}',
  forecast JSONB DEFAULT '{}',
  insights JSONB DEFAULT '{}',
  notifications JSONB DEFAULT '{}',
  status TEXT DEFAULT 'generated' CHECK (status IN ('generating', 'generated', 'sent', 'archived', 'failed')),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Scores History (for trend analysis)
CREATE TABLE IF NOT EXISTS ai_scores_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES executive_reports(id) ON DELETE CASCADE,
  score_type TEXT NOT NULL,
  score_value INTEGER CHECK (score_value >= 0 AND score_value <= 100),
  previous_value INTEGER,
  change INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Notifications
CREATE TABLE IF NOT EXISTS ai_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES executive_reports(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('warning', 'critical', 'info', 'success')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monthly Trends
CREATE TABLE IF NOT EXISTS monthly_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key TEXT NOT NULL,
  metric_value NUMERIC,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  trend TEXT CHECK (trend IN ('up', 'down', 'stable')),
  change_percent NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_executive_reports_month ON executive_reports(report_month);
CREATE INDEX IF NOT EXISTS idx_executive_reports_year ON executive_reports(report_year);
CREATE INDEX IF NOT EXISTS idx_ai_notifications_read ON ai_notifications(read);
CREATE INDEX IF NOT EXISTS idx_ai_notifications_type ON ai_notifications(type);
CREATE INDEX IF NOT EXISTS idx_ai_scores_type ON ai_scores_history(score_type);
CREATE INDEX IF NOT EXISTS idx_monthly_trends_key ON monthly_trends(metric_key);

-- Enable RLS
ALTER TABLE executive_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_scores_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_trends ENABLE ROW LEVEL SECURITY;

-- RLS Policies (admin only)
CREATE POLICY "admin_all_executive_reports" ON executive_reports FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "admin_all_ai_scores" ON ai_scores_history FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "admin_all_ai_notifications" ON ai_notifications FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "admin_all_monthly_trends" ON monthly_trends FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());