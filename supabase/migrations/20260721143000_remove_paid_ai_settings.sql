-- KORIX AI is intentionally free/local. Remove legacy paid-model settings
-- from existing databases so the admin panel cannot suggest external AI usage.

DELETE FROM public.ai_settings
WHERE setting_key IN ('model', 'temperature', 'max_tokens');

UPDATE public.ai_settings
SET
  setting_value = 'Witaj! Jestem KORIX AI, bezpłatny asystent KORIX3D. Mogę sprawdzić stany sklepu, materiały, terminy i pomóc przygotować wycenę.',
  description = 'Greeting message for the free local assistant'
WHERE setting_key = 'greeting';

UPDATE public.ai_settings
SET description = 'Enable or disable the free local assistant'
WHERE setting_key = 'enabled';

UPDATE public.ai_settings
SET description = 'Optional local assistant instructions shown in admin panel'
WHERE setting_key = 'system_prompt';

