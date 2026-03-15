-- Chat schema: conversation list + messages (Supabase).
-- Run in Supabase Dashboard → SQL Editor.
-- Requires: public.events (for event_id FK). author_id is profile UUID (profiles or app_profiles).

-- Chats (conversation list for Messages tab)
CREATE TABLE IF NOT EXISTS public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  title text NOT NULL,
  avatar text,
  last_message text,
  time text,
  unread int DEFAULT 0,
  active boolean DEFAULT false,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Chat messages (list storage; live messaging in app uses Firebase Firestore)
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  author text,
  author_avatar text,
  author_id uuid,
  text text NOT NULL,
  time text,
  image text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chats_time ON public.chats(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON public.chat_messages(chat_id);

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon read chats" ON public.chats;
DROP POLICY IF EXISTS "Allow anon insert chats" ON public.chats;
DROP POLICY IF EXISTS "Allow anon update chats" ON public.chats;
CREATE POLICY "Allow anon read chats" ON public.chats FOR SELECT USING (true);
CREATE POLICY "Allow anon insert chats" ON public.chats FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update chats" ON public.chats FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow anon read chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow anon insert chat_messages" ON public.chat_messages;
CREATE POLICY "Allow anon read chat_messages" ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "Allow anon insert chat_messages" ON public.chat_messages FOR INSERT WITH CHECK (true);
