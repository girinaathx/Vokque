ALTER TABLE public.memories
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS memories_user_pinned_idx ON public.memories (user_id, pinned_at DESC NULLS LAST, created_at DESC);