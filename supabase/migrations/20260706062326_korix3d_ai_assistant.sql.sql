-- AI Conversation History
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Messages (conversation history)
CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Feedback
CREATE TABLE IF NOT EXISTS ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES ai_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Analytics Log
CREATE TABLE IF NOT EXISTS ai_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  question_type TEXT,
  query TEXT NOT NULL,
  response_time_ms INTEGER,
  tokens_used INTEGER,
  model TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Settings
CREATE TABLE IF NOT EXISTS ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default AI settings
INSERT INTO ai_settings (setting_key, setting_value, description) VALUES
  ('system_prompt', 'Jesteś KORIX AI - inteligentnym asystentem firmy KORIX3D, specjalizującej się w profesjonalnym druku 3D. Pomagasz klientom w wyborze materiałów, technologii, ustawień druku oraz odpowiedziach na pytania dotyczące produkcji. Odpowiadaj profesjonalnie, przyjaźnie i konkretnie. Używaj języka polskiego.', 'System prompt for AI'),
  ('temperature', '0.7', 'AI temperature'),
  ('max_tokens', '2048', 'Maximum tokens per response'),
  ('greeting', 'Witaj! Jestem KORIX AI, Twój asystent druku 3D. Jak mogę Ci pomóc?', 'Greeting message'),
  ('enabled', 'true', 'Enable/disable AI assistant'),
  ('model', 'gpt-4.1', 'OpenAI model to use')
ON CONFLICT (setting_key) DO NOTHING;

-- File uploads for AI analysis
CREATE TABLE IF NOT EXISTS ai_file_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  file_url TEXT,
  analysis_result JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_session ON ai_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_message ON ai_feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_user ON ai_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created ON ai_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_file_uploads_conversation ON ai_file_uploads(conversation_id);

-- Enable RLS
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_file_uploads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_conversations
CREATE POLICY "select_own_conversations" ON ai_conversations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_conversations" ON ai_conversations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_conversations" ON ai_conversations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admin_all_conversations" ON ai_conversations FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- RLS Policies for ai_messages
CREATE POLICY "select_own_messages" ON ai_messages FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM ai_conversations 
      WHERE ai_conversations.id = ai_messages.conversation_id 
      AND ai_conversations.user_id = auth.uid()
    )
    OR is_admin()
  );
CREATE POLICY "insert_own_messages" ON ai_messages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_conversations 
      WHERE ai_conversations.id = ai_messages.conversation_id 
      AND ai_conversations.user_id = auth.uid()
    )
    OR is_admin()
  );
CREATE POLICY "admin_all_messages" ON ai_messages FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- RLS Policies for ai_feedback
CREATE POLICY "select_own_feedback" ON ai_feedback FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "insert_own_feedback" ON ai_feedback FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin_all_feedback" ON ai_feedback FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- RLS Policies for ai_logs (admin only)
CREATE POLICY "admin_all_logs" ON ai_logs FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- RLS Policies for ai_settings (admin only)
CREATE POLICY "admin_all_settings" ON ai_settings FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "anon_read_enabled_settings" ON ai_settings FOR SELECT
  TO authenticated, anon USING (
    setting_key IN ('greeting', 'enabled')
  );

-- RLS Policies for ai_file_uploads
CREATE POLICY "select_own_uploads" ON ai_file_uploads FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "insert_own_uploads" ON ai_file_uploads FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin_all_uploads" ON ai_file_uploads FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_settings_updated_at
  BEFORE UPDATE ON ai_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_ai_conversations_updated_at
  BEFORE UPDATE ON ai_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();