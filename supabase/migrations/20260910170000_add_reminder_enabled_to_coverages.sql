-- Adiciona campo reminder_enabled para controle de lembretes push de coberturas agendadas
ALTER TABLE public.coverages
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.coverages.reminder_enabled IS
  'Indica se o lembrete de notificação push antes da cobertura está ativo para esta partida.';

ALTER TABLE public.event_coverages
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.event_coverages.reminder_enabled IS
  'Indica se o lembrete de notificação push antes da cobertura está ativo para este evento esportivo.';
