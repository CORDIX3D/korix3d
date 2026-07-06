-- Accounting Reports Storage
CREATE TABLE IF NOT EXISTS accounting_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_month DATE NOT NULL,
  report_year INTEGER NOT NULL,
  report_type TEXT DEFAULT 'monthly' CHECK (report_type IN ('monthly', 'quarterly', 'yearly', 'custom')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  status TEXT DEFAULT 'generated' CHECK (status IN ('generating', 'generated', 'sent', 'failed')),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_to TEXT[],
  sent_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  summary JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report Schedules
CREATE TABLE IF NOT EXISTS report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('monthly', 'weekly', 'daily')),
  active BOOLEAN DEFAULT true,
  last_run TIMESTAMPTZ,
  next_run TIMESTAMPTZ,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report Email Recipients
CREATE TABLE IF NOT EXISTS report_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  active BOOLEAN DEFAULT true,
  reports TEXT[] DEFAULT ARRAY['monthly'],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financial Data Cache (for faster reporting)
CREATE TABLE IF NOT EXISTS financial_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,
  cache_data JSONB NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_accounting_reports_month ON accounting_reports(report_month);
CREATE INDEX IF NOT EXISTS idx_accounting_reports_year ON accounting_reports(report_year);
CREATE INDEX IF NOT EXISTS idx_accounting_reports_status ON accounting_reports(status);
CREATE INDEX IF NOT EXISTS idx_report_schedules_next_run ON report_schedules(next_run);
CREATE INDEX IF NOT EXISTS idx_financial_cache_period ON financial_cache(period_start, period_end);

-- Enable RLS
ALTER TABLE accounting_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies (admin only for financial data)
CREATE POLICY "admin_all_accounting_reports" ON accounting_reports FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "admin_all_report_schedules" ON report_schedules FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "admin_all_report_recipients" ON report_recipients FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "admin_all_financial_cache" ON financial_cache FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Insert default schedule
INSERT INTO report_schedules (schedule_type, next_run, config)
VALUES ('monthly', date_trunc('month', CURRENT_DATE + INTERVAL '1 month'), '{"auto_generate": true, "auto_send": false}')
ON CONFLICT DO NOTHING;

-- Create storage bucket for reports
INSERT INTO storage.buckets (id, name, public)
VALUES ('accounting-reports', 'accounting-reports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for accounting reports
CREATE POLICY "admin_upload_reports" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'accounting-reports' AND is_admin()
  );

CREATE POLICY "admin_download_reports" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'accounting-reports' AND is_admin()
  );

CREATE POLICY "admin_delete_reports" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'accounting-reports' AND is_admin()
  );