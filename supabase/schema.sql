-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    age INTEGER,
    front_photo_url TEXT,
    side_photo_url TEXT,
    known_for TEXT,
    red_flag TEXT,
    guilty_pleasure TEXT,
    secret_talent TEXT,
    hot_take TEXT,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium')),
    games_hosted_this_month INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create question_packs table
CREATE TABLE IF NOT EXISTS public.question_packs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    is_premium BOOLEAN DEFAULT FALSE,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create questions table
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pack_id UUID REFERENCES public.question_packs(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK (question_type IN ('voting', 'trial')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create game_rooms table
CREATE TABLE IF NOT EXISTS public.game_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    join_code TEXT UNIQUE NOT NULL,
    host_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    game_mode TEXT DEFAULT 'standard' CHECK (game_mode IN ('standard', 'drinking')),
    question_pack_id UUID REFERENCES public.question_packs(id),
    game_length TEXT DEFAULT 'standard' CHECK (game_length IN ('quick', 'standard', 'extended')),
    status TEXT DEFAULT 'lobby' CHECK (status IN ('lobby', 'voting', 'trial', 'finished')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create game_sessions table
CREATE TABLE IF NOT EXISTS public.game_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_room_id UUID REFERENCES public.game_rooms(id) ON DELETE CASCADE,
    current_round INTEGER DEFAULT 1,
    current_phase TEXT DEFAULT 'voting' CHECK (current_phase IN ('voting', 'trial')),
    current_question_id UUID REFERENCES public.questions(id),
    suspect_id UUID REFERENCES public.users(id),
    timer_end_time TIMESTAMPTZ,
    scores JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create players table
CREATE TABLE IF NOT EXISTS public.players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_room_id UUID REFERENCES public.game_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    points INTEGER DEFAULT 0,
    guilty_verdicts INTEGER DEFAULT 0,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(game_room_id, user_id)
);

-- Create votes table
CREATE TABLE IF NOT EXISTS public.votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_session_id UUID REFERENCES public.game_sessions(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    voter_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    voted_for_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    vote_type TEXT NOT NULL CHECK (vote_type IN ('suspect', 'verdict')),
    vote_value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_game_rooms_join_code ON public.game_rooms(join_code);
CREATE INDEX idx_game_rooms_status ON public.game_rooms(status);
CREATE INDEX idx_players_game_room ON public.players(game_room_id);
CREATE INDEX idx_players_user ON public.players(user_id);
CREATE INDEX idx_votes_session ON public.votes(game_session_id);
CREATE INDEX idx_votes_voter ON public.votes(voter_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view all profiles" ON public.users
    FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for question_packs table
CREATE POLICY "Anyone can view question packs" ON public.question_packs
    FOR SELECT USING (true);

-- RLS Policies for questions table
CREATE POLICY "Anyone can view questions" ON public.questions
    FOR SELECT USING (true);

-- RLS Policies for game_rooms table
CREATE POLICY "Anyone can view game rooms" ON public.game_rooms
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create game rooms" ON public.game_rooms
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Host can update their game room" ON public.game_rooms
    FOR UPDATE USING (auth.uid() = host_id);

-- RLS Policies for game_sessions table
CREATE POLICY "Players can view their game sessions" ON public.game_sessions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.players p
            WHERE p.game_room_id = game_sessions.game_room_id
            AND p.user_id = auth.uid()
        )
    );

CREATE POLICY "Host can update game sessions" ON public.game_sessions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.game_rooms gr
            WHERE gr.id = game_sessions.game_room_id
            AND gr.host_id = auth.uid()
        )
    );

CREATE POLICY "Host can insert game sessions" ON public.game_sessions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.game_rooms gr
            WHERE gr.id = game_sessions.game_room_id
            AND gr.host_id = auth.uid()
        )
    );

-- RLS Policies for players table
CREATE POLICY "Anyone can view players in a game" ON public.players
    FOR SELECT USING (true);

CREATE POLICY "Users can join games as players" ON public.players
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Host can update players in their game" ON public.players
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.game_rooms gr
            WHERE gr.id = players.game_room_id
            AND gr.host_id = auth.uid()
        )
    );

-- RLS Policies for votes table
CREATE POLICY "Players can view votes in their game" ON public.votes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.game_sessions gs
            JOIN public.players p ON p.game_room_id = gs.game_room_id
            WHERE gs.id = votes.game_session_id
            AND p.user_id = auth.uid()
        )
    );

CREATE POLICY "Players can submit their own votes" ON public.votes
    FOR INSERT WITH CHECK (auth.uid() = voter_id);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-photos', 'user-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Anyone can view user photos" ON storage.objects
    FOR SELECT USING (bucket_id = 'user-photos');

CREATE POLICY "Users can upload their own photos" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'user-photos' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can update their own photos" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'user-photos' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete their own photos" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'user-photos' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for users table
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for game_sessions table
CREATE TRIGGER update_game_sessions_updated_at BEFORE UPDATE ON public.game_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to reset monthly hosting count
CREATE OR REPLACE FUNCTION reset_monthly_hosting_count()
RETURNS void AS $$
BEGIN
    UPDATE public.users SET games_hosted_this_month = 0;
END;
$$ language 'plpgsql';