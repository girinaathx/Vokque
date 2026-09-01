CREATE TABLE public.artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id uuid,
  filename text NOT NULL,
  mime_type text NOT NULL,
  extension text NOT NULL,
  kind text NOT NULL,
  size_bytes bigint NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX artifacts_user_idx ON public.artifacts (user_id, created_at DESC);
CREATE INDEX artifacts_thread_idx ON public.artifacts (thread_id);

GRANT SELECT, INSERT, DELETE ON public.artifacts TO authenticated;
GRANT ALL ON public.artifacts TO service_role;

ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own artifacts" ON public.artifacts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own artifacts" ON public.artifacts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own artifacts" ON public.artifacts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Storage: users may read only their own folder in the private artifacts bucket.
CREATE POLICY "Users read own artifact objects" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'artifacts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own artifact objects" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'artifacts' AND (storage.foldername(name))[1] = auth.uid()::text);
