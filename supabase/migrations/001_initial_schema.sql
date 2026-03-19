-- YouTube RAG Phase 2: User Accounts Schema
-- Applied to Supabase when the account is created (Step 5.1)

-- Notes table: user-created notes per video
CREATE TABLE public.notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  video_id TEXT NOT NULL,
  video_title TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Chat sessions: one per user per video conversation
CREATE TABLE public.chat_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  video_id TEXT NOT NULL,
  video_title TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Chat messages: individual messages within a session
CREATE TABLE public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('user', 'assistant')) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can CRUD own notes"
  ON public.notes FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own chat sessions"
  ON public.chat_sessions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD messages in own sessions"
  ON public.chat_messages FOR ALL
  USING (session_id IN (
    SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()
  ));

-- Indexes for common queries
CREATE INDEX idx_notes_user_video ON public.notes(user_id, video_id);
CREATE INDEX idx_chat_sessions_user ON public.chat_sessions(user_id);
CREATE INDEX idx_chat_messages_session ON public.chat_messages(session_id);

-- Auto-update updated_at on notes
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
