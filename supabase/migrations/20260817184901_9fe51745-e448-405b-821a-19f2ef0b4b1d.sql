CREATE OR REPLACE FUNCTION public.delete_content_source(p_source_id uuid, p_delete_news boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _removed integer := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.content_sources
    WHERE id = p_source_id AND user_id = _uid
  ) THEN
    RAISE EXCEPTION 'Fonte não encontrada';
  END IF;

  IF p_delete_news THEN
    WITH del AS (
      DELETE FROM public.news_items
      WHERE source_id = p_source_id AND user_id = _uid
      RETURNING 1
    )
    SELECT count(*) INTO _removed FROM del;
  END IF;

  DELETE FROM public.content_sources WHERE id = p_source_id AND user_id = _uid;

  RETURN _removed;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_content_source_news(p_source_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _removed integer := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.content_sources
    WHERE id = p_source_id AND user_id = _uid
  ) THEN
    RAISE EXCEPTION 'Fonte não encontrada';
  END IF;

  WITH del AS (
    DELETE FROM public.news_items
    WHERE source_id = p_source_id AND user_id = _uid
    RETURNING 1
  )
  SELECT count(*) INTO _removed FROM del;

  RETURN _removed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_content_source(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_content_source_news(uuid) TO authenticated;

-- Limpeza única dos itens órfãos deixados por exclusões anteriores.
DELETE FROM public.news_items WHERE source_id IS NULL;