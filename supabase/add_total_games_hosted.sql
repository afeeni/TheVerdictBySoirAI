-- Add total_games_hosted column to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS total_games_hosted integer NOT NULL DEFAULT 0;

-- Update existing users to set their total_games_hosted to their current games_hosted_this_month
-- (Optional: only if you want to carry over the current monthly count as the starting total)
UPDATE public.users
SET total_games_hosted = games_hosted_this_month
WHERE total_games_hosted = 0;

-- Add a comment to the column for documentation
COMMENT ON COLUMN public.users.total_games_hosted IS 'Total number of games hosted by this user (all time)';
