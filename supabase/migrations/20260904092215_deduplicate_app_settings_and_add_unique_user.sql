WITH ranked_settings AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id
      ORDER BY updated_at DESC NULLS LAST,
               created_at DESC NULLS LAST,
               id DESC
    ) AS position
  FROM public.app_settings
  WHERE user_id IS NOT NULL
)
DELETE FROM public.app_settings AS settings
USING ranked_settings AS ranked
WHERE settings.id = ranked.id
  AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS app_settings_user_id_unique_idx
  ON public.app_settings (user_id);
