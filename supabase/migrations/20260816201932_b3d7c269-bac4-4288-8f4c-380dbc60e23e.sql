ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deletion_batch_id uuid,
  ADD COLUMN IF NOT EXISTS import_batch_id uuid;

CREATE INDEX IF NOT EXISTS matches_deleted_at_idx ON public.matches (deleted_at);
CREATE INDEX IF NOT EXISTS matches_import_batch_id_idx ON public.matches (import_batch_id);
CREATE INDEX IF NOT EXISTS matches_deletion_batch_id_idx ON public.matches (deletion_batch_id);

CREATE TABLE IF NOT EXISTS public.operation_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  operation_type text NOT NULL,
  entity_type text NOT NULL DEFAULT 'matches',
  source_id uuid,
  import_batch_id uuid,
  description text,
  affected_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  undone_at timestamptz,
  undone_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operation_batches TO authenticated;
GRANT ALL ON public.operation_batches TO service_role;

ALTER TABLE public.operation_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own operation batches"
ON public.operation_batches
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS operation_batches_user_created_idx
  ON public.operation_batches (user_id, created_at DESC);