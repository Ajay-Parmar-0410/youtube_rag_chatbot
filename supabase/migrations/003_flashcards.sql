-- Phase 3: Flashcard Persistence
-- Save AI-generated flashcards per user per video

CREATE TABLE public.flashcards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  video_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own flashcards"
  ON public.flashcards FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX idx_flashcards_user_video ON public.flashcards(user_id, video_id);
