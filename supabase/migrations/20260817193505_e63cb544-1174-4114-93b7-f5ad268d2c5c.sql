ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS feedback_whatsapp_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feedback_whatsapp_opt_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS founder_community_interest boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS post_trial_contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS post_trial_contacted_by uuid;