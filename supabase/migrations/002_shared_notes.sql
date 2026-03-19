-- Phase 3: Share Notes Feature
-- Adds sharing capability to notes

ALTER TABLE public.notes ADD COLUMN share_id UUID UNIQUE;
ALTER TABLE public.notes ADD COLUMN is_shared BOOLEAN DEFAULT false;

-- Allow anyone to read shared notes (no auth required)
CREATE POLICY "Anyone can read shared notes"
  ON public.notes FOR SELECT
  USING (is_shared = true);

-- Index for looking up shared notes by share_id
CREATE INDEX idx_notes_share_id ON public.notes(share_id) WHERE share_id IS NOT NULL;
