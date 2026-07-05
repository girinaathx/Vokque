ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS threads_user_pinned_idx ON public.threads(user_id, pinned_at DESC NULLS LAST, updated_at DESC);