-- Create table for game scores
CREATE TABLE IF NOT EXISTS public.game_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  game_type text NOT NULL,
  score integer NOT NULL,
  completed_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;

-- Policies for game_scores
CREATE POLICY "Game scores are viewable by everyone"
ON public.game_scores
FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own scores"
ON public.game_scores
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scores"
ON public.game_scores
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for better performance on leaderboard queries
CREATE INDEX idx_game_scores_game_type_score ON public.game_scores(game_type, score DESC);
CREATE INDEX idx_game_scores_user_id ON public.game_scores(user_id);

-- Add database constraint for input validation
ALTER TABLE public.game_scores 
ADD CONSTRAINT game_type_length CHECK (char_length(game_type) <= 50);

ALTER TABLE public.game_scores 
ADD CONSTRAINT score_positive CHECK (score >= 0);