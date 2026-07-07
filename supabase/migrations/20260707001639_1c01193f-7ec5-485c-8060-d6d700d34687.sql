
CREATE POLICY "Users can view own feyncloud files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'feyncloud' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own feyncloud files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'feyncloud' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own feyncloud files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'feyncloud' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'feyncloud' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own feyncloud files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'feyncloud' AND auth.uid()::text = (storage.foldername(name))[1]);
