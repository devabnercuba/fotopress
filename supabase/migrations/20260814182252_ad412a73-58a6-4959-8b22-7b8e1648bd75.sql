drop policy if exists "assets read" on storage.objects;
create policy "assets read" on storage.objects for select to authenticated
using (
  bucket_id = 'assets'
  and (
    (storage.foldername(name))[1] <> 'users'
    or (storage.foldername(name))[2] = auth.uid()::text
  )
);