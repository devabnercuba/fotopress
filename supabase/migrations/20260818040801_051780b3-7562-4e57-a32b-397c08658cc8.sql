CREATE TABLE public.tutorial_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  youtube_url text NOT NULL,
  youtube_video_id text NOT NULL,
  category text NOT NULL DEFAULT 'Outros',
  related_route text,
  sort_order integer NOT NULL DEFAULT 0,
  is_featured boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorial_videos TO authenticated;
GRANT ALL ON public.tutorial_videos TO service_role;

ALTER TABLE public.tutorial_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read published tutorials"
ON public.tutorial_videos FOR SELECT TO authenticated
USING (is_published OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert tutorials"
ON public.tutorial_videos FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update tutorials"
ON public.tutorial_videos FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete tutorials"
ON public.tutorial_videos FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_tutorial_videos_updated_at
BEFORE UPDATE ON public.tutorial_videos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enforce_single_featured_tutorial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_featured THEN
    UPDATE public.tutorial_videos
      SET is_featured = false
      WHERE id <> NEW.id AND is_featured;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tutorial_videos_single_featured
AFTER INSERT OR UPDATE OF is_featured ON public.tutorial_videos
FOR EACH ROW WHEN (NEW.is_featured)
EXECUTE FUNCTION public.enforce_single_featured_tutorial();