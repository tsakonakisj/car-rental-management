-- Add unique constraint on pricing (category, season_id) to prevent duplicate rows
CREATE UNIQUE INDEX IF NOT EXISTS pricing_category_season_key
  ON public.pricing (category, season_id);