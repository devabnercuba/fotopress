ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS primary_sport text NOT NULL DEFAULT 'futebol',
  ADD COLUMN IF NOT EXISTS accent text NOT NULL DEFAULT 'indigo';

COMMENT ON COLUMN public.app_settings.primary_sport IS
  'Modalidade esportiva principal escolhida pelo usuário.';

COMMENT ON COLUMN public.app_settings.accent IS
  'Cor de destaque escolhida pelo usuário para personalização da interface.';
