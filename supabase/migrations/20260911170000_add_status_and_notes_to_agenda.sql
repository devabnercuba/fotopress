-- Garante que coverages e event_coverages tenham campos de status e notes
ALTER TABLE public.coverages
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.event_coverages
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS notes text;
