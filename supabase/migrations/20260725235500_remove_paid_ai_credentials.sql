-- KORIX AI is a deterministic local assistant. Remove any legacy provider
-- credentials/settings and redact secrets that may have been pasted into chat.

DELETE FROM public.ai_settings
WHERE lower(setting_key) IN (
  'api_key',
  'openai_api_key',
  'openai_key',
  'provider',
  'model',
  'temperature',
  'max_tokens'
);

UPDATE public.ai_settings
SET setting_value = '[USUNIĘTY SEKRET]'
WHERE setting_value ~* '(sk|rk)_(test|live)_[A-Za-z0-9]{16,}'
  OR setting_value ~* 'sk-(proj-)?[A-Za-z0-9_-]{16,}'
  OR setting_value ~* 'sbp_[A-Za-z0-9]{16,}'
  OR setting_value ~* 'whsec_[A-Za-z0-9]{16,}'
  OR setting_value ~* 'OPENAI_API_KEY[[:space:]]*=';

UPDATE public.ai_messages
SET content = regexp_replace(
  regexp_replace(
    regexp_replace(
      regexp_replace(content, '(sk|rk)_(test|live)_[A-Za-z0-9]{16,}', '[USUNIĘTY SEKRET]', 'gi'),
      'sk-(proj-)?[A-Za-z0-9_-]{16,}', '[USUNIĘTY SEKRET]', 'gi'
    ),
    'sbp_[A-Za-z0-9]{16,}', '[USUNIĘTY SEKRET]', 'gi'
  ),
  'whsec_[A-Za-z0-9]{16,}', '[USUNIĘTY SEKRET]', 'gi'
)
WHERE content ~* '(sk|rk)_(test|live)_[A-Za-z0-9]{16,}|sk-(proj-)?[A-Za-z0-9_-]{16,}|sbp_[A-Za-z0-9]{16,}|whsec_[A-Za-z0-9]{16,}';

UPDATE public.ai_logs
SET query = regexp_replace(
  regexp_replace(
    regexp_replace(
      regexp_replace(query, '(sk|rk)_(test|live)_[A-Za-z0-9]{16,}', '[USUNIĘTY SEKRET]', 'gi'),
      'sk-(proj-)?[A-Za-z0-9_-]{16,}', '[USUNIĘTY SEKRET]', 'gi'
    ),
    'sbp_[A-Za-z0-9]{16,}', '[USUNIĘTY SEKRET]', 'gi'
  ),
  'whsec_[A-Za-z0-9]{16,}', '[USUNIĘTY SEKRET]', 'gi'
)
WHERE query ~* '(sk|rk)_(test|live)_[A-Za-z0-9]{16,}|sk-(proj-)?[A-Za-z0-9_-]{16,}|sbp_[A-Za-z0-9]{16,}|whsec_[A-Za-z0-9]{16,}';
