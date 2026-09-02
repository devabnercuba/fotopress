CREATE POLICY "assets read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'assets');
CREATE POLICY "assets insert" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'assets');
CREATE POLICY "assets update" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'assets') WITH CHECK (bucket_id = 'assets');
CREATE POLICY "assets delete" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'assets');