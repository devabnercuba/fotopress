DROP POLICY IF EXISTS "assets insert" ON storage.objects;
DROP POLICY IF EXISTS "assets update" ON storage.objects;
DROP POLICY IF EXISTS "assets delete" ON storage.objects;

CREATE POLICY "assets insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'assets'
  AND (
    (storage.foldername(name))[1] <> 'users'
    OR (storage.foldername(name))[2] = auth.uid()::text
  )
);

CREATE POLICY "assets update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'assets'
  AND (
    (storage.foldername(name))[1] <> 'users'
    OR (storage.foldername(name))[2] = auth.uid()::text
  )
)
WITH CHECK (
  bucket_id = 'assets'
  AND (
    (storage.foldername(name))[1] <> 'users'
    OR (storage.foldername(name))[2] = auth.uid()::text
  )
);

CREATE POLICY "assets delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'assets'
  AND (
    (storage.foldername(name))[1] <> 'users'
    OR (storage.foldername(name))[2] = auth.uid()::text
  )
);