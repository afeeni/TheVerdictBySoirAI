-- Row Level Security Policies for The Verdict

-- ============================================
-- GAME_ROOMS TABLE
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can create game rooms" ON public.game_rooms;
DROP POLICY IF EXISTS "Anyone can view game rooms" ON public.game_rooms;
DROP POLICY IF EXISTS "Hosts can update own game rooms" ON public.game_rooms;
DROP POLICY IF EXISTS "Hosts can delete own game rooms" ON public.game_rooms;

-- Allow authenticated users to create game rooms
CREATE POLICY "Users can create game rooms"
ON public.game_rooms FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = host_id);

-- Allow anyone to read game rooms (needed to join games)
CREATE POLICY "Anyone can view game rooms"
ON public.game_rooms FOR SELECT
TO authenticated
USING (true);

-- Allow host to update their own game rooms
CREATE POLICY "Hosts can update own game rooms"
ON public.game_rooms FOR UPDATE
TO authenticated
USING (auth.uid() = host_id);

-- Allow host to delete their own game rooms
CREATE POLICY "Hosts can delete own game rooms"
ON public.game_rooms FOR DELETE
TO authenticated
USING (auth.uid() = host_id);

-- ============================================
-- GAME_SESSIONS TABLE
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can create game sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Anyone can view game sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Users can update game sessions" ON public.game_sessions;

-- Allow authenticated users to create game sessions
CREATE POLICY "Users can create game sessions"
ON public.game_sessions FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow anyone to view game sessions
CREATE POLICY "Anyone can view game sessions"
ON public.game_sessions FOR SELECT
TO authenticated
USING (true);

-- Allow anyone to update game sessions (for game state changes)
CREATE POLICY "Users can update game sessions"
ON public.game_sessions FOR UPDATE
TO authenticated
USING (true);

-- ============================================
-- PLAYERS TABLE
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can join games" ON public.players;
DROP POLICY IF EXISTS "Anyone can view players" ON public.players;
DROP POLICY IF EXISTS "Users can update own player record" ON public.players;
DROP POLICY IF EXISTS "Users can leave games" ON public.players;

-- Allow authenticated users to join games as players
CREATE POLICY "Users can join games"
ON public.players FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow anyone to view players
CREATE POLICY "Anyone can view players"
ON public.players FOR SELECT
TO authenticated
USING (true);

-- Allow users to update their own player record
CREATE POLICY "Users can update own player record"
ON public.players FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Allow users to leave games (delete their player record)
CREATE POLICY "Users can leave games"
ON public.players FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- VOTES TABLE
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can cast votes" ON public.votes;
DROP POLICY IF EXISTS "Anyone can view votes" ON public.votes;
DROP POLICY IF EXISTS "Users can update own votes" ON public.votes;

-- Allow authenticated users to cast votes
CREATE POLICY "Users can cast votes"
ON public.votes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = voter_id);

-- Allow anyone to view votes
CREATE POLICY "Anyone can view votes"
ON public.votes FOR SELECT
TO authenticated
USING (true);

-- Allow users to update their own votes (if needed)
CREATE POLICY "Users can update own votes"
ON public.votes FOR UPDATE
TO authenticated
USING (auth.uid() = voter_id);

-- ============================================
-- QUESTION_PACKS TABLE (Read-only for users)
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view question packs" ON public.question_packs;

-- Allow anyone to view question packs
CREATE POLICY "Anyone can view question packs"
ON public.question_packs FOR SELECT
TO authenticated
USING (true);

-- ============================================
-- QUESTIONS TABLE (Read-only for users)
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view questions" ON public.questions;

-- Allow anyone to view questions
CREATE POLICY "Anyone can view questions"
ON public.questions FOR SELECT
TO authenticated
USING (true);
