ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS threads_archived_at_idx ON public.threads (archived_at);